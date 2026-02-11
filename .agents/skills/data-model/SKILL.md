---
name: workout-data-model
description: >
  Use this skill whenever creating, modifying, or querying the SQLite database schema,
  writing migration code, building database query functions, or working with any data
  persistence logic. Also use when the task involves data export, data types, or
  table relationships. Do NOT use for UI components, styling, or navigation.
---

# Workout Tracker Data Model

## Core principle

Store raw training facts forever. Compute everything else.

Raw data = what happened (exercise, reps, load, effort, timestamp).
Derived data = what it means (effective sets, volume per muscle, zone colors, progression suggestions).

Raw data is written once and never modified. Derived data is recomputed on read.

## SQLite schema

### exercises (global library — never deleted, only deactivated)

```sql
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,                    -- slug: 'barbell-back-squat'
  name TEXT NOT NULL,                     -- 'Barbell Back Squat'
  category TEXT NOT NULL,                 -- 'compound' | 'isolation' | 'metcon' | 'mobility'
  equipment TEXT,                         -- 'barbell' | 'cable' | 'dumbbell' | 'machine' | 'bodyweight'
  is_active INTEGER NOT NULL DEFAULT 1    -- soft delete
);
```

### exercise_muscle_mappings (which muscles each exercise works)

```sql
CREATE TABLE exercise_muscle_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  muscle_group TEXT NOT NULL,             -- 'quads' | 'chest' | 'lats' | 'biceps' | etc.
  role TEXT NOT NULL,                     -- 'direct' | 'indirect'
  UNIQUE(exercise_id, muscle_group)
);
```

Credit is NOT stored here. Role determines credit at computation time:
- direct → 1.0
- indirect → 0.5

This is intentional. If research updates the indirect multiplier (e.g., from 0.5 to 0.3), we change ONE constant in `volumeCalculator.ts` and all historical data recomputes correctly.

### muscle_groups (reference table)

```sql
CREATE TABLE muscle_groups (
  id TEXT PRIMARY KEY,                    -- 'quads', 'chest', 'lats', etc.
  display_name TEXT NOT NULL,             -- 'Quadriceps', 'Chest', 'Latissimus Dorsi'
  size_category TEXT NOT NULL,            -- 'large' | 'small'
  mev_low REAL NOT NULL,                 -- e.g., 3.0
  mev_high REAL NOT NULL,                -- e.g., 6.0
  optimal_low REAL NOT NULL,             -- e.g., 6.0
  optimal_high REAL NOT NULL,            -- e.g., 10.0
  mrv_low REAL NOT NULL,                 -- e.g., 10.0
  mrv_high REAL NOT NULL,                -- e.g., 16.0
  evidence_grade TEXT NOT NULL            -- 'HIGH' | 'MEDIUM' | 'LOW'
);
```

### programs

```sql
CREATE TABLE programs (
  id TEXT PRIMARY KEY,                    -- 'hybrid-bb-2'
  name TEXT NOT NULL,                     -- 'Hybrid Bodybuilding 2.0'
  is_active INTEGER NOT NULL DEFAULT 1
);
```

### program_phases

```sql
CREATE TABLE program_phases (
  id TEXT PRIMARY KEY,                    -- 'hybrid-bb-2-phase-1'
  program_id TEXT NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL,                     -- 'Phase 1'
  phase_order INTEGER NOT NULL,           -- 1, 2, 3...
  is_active INTEGER NOT NULL DEFAULT 1
);
```

### day_templates (what exercises belong to which day)

```sql
CREATE TABLE day_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase_id TEXT NOT NULL REFERENCES program_phases(id),
  day_number INTEGER NOT NULL,            -- 1-6
  day_name TEXT NOT NULL,                 -- 'Lower A', 'Upper Push', etc.
  UNIQUE(phase_id, day_number)
);
```

### template_exercise_slots (exercises within a day, with alternates)

```sql
CREATE TABLE template_exercise_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_template_id INTEGER NOT NULL REFERENCES day_templates(id),
  slot_order INTEGER NOT NULL,            -- display order within the day
  default_exercise_id TEXT NOT NULL REFERENCES exercises(id),
  target_sets INTEGER NOT NULL DEFAULT 2,
  target_rep_low INTEGER NOT NULL,        -- e.g., 6
  target_rep_high INTEGER NOT NULL,       -- e.g., 10
  rest_seconds INTEGER,                   -- suggested rest time
  notes TEXT                              -- e.g., 'slow eccentric 3s'
);
```

### slot_alternate_exercises (which exercises can substitute in a slot)

```sql
CREATE TABLE slot_alternate_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL REFERENCES template_exercise_slots(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  UNIQUE(slot_id, exercise_id)
);
```

### workouts (actual logged sessions)

```sql
CREATE TABLE workouts (
  id TEXT PRIMARY KEY,                    -- UUID
  phase_id TEXT REFERENCES program_phases(id),
  day_template_id INTEGER REFERENCES day_templates(id),
  started_at TEXT NOT NULL,               -- ISO 8601
  completed_at TEXT,                      -- ISO 8601, null if in progress
  prs_score INTEGER,                      -- 0-10, pre-workout readiness
  bodyweight_kg REAL,                     -- optional, logged if weighed that day
  notes TEXT
);
```

### sets (the sacred raw data — never modify, never delete)

```sql
CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id TEXT NOT NULL REFERENCES workouts(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  set_order INTEGER NOT NULL,             -- 1, 2, 3... within this exercise in this workout
  reps INTEGER NOT NULL,
  load_kg REAL NOT NULL,                  -- 0 for bodyweight exercises
  effort_label TEXT NOT NULL,             -- 'easy' | 'productive' | 'hard' | 'failure'
  is_warmup INTEGER NOT NULL DEFAULT 0,   -- warmup sets don't count for volume
  logged_at TEXT NOT NULL,                -- ISO 8601 timestamp
  notes TEXT
);
```

### first_workout_anchor (for rolling week calculation)

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Store 'first_workout_timestamp' here after the very first workout is completed.
```

## Query patterns

### Weekly volume per muscle group

```
For a given week (start_date, end_date):
1. Get all non-warmup sets in that date range
2. For each set, look up the exercise's muscle mappings
3. For each mapping:
   - base_credit = 1.0 if role='direct', 0.5 if role='indirect'
   - effort_multiplier = 1.0 if effort_label in ('productive','hard','failure'), 0.5 if 'easy'
   - effective_credit = base_credit * effort_multiplier
4. Sum effective_credit per muscle_group
5. Compare sums against muscle_groups.mev_low/high, optimal_low/high, mrv_low/high
6. Assign zone: RED (below mev_low), YELLOW (mev_low to optimal_low), GREEN (optimal_low to optimal_high), ORANGE (above mrv_high)
```

### Progression check

```
For a given exercise:
1. Get the two most recent workout sessions containing this exercise
2. For each session, check if any working set hit reps > target_rep_high
3. If BOTH sessions have at least one set exceeding the rep target:
   → Suggest load increase
   → Upper body: +2.5% (round to nearest 1.25kg or 2.5kg plate)
   → Lower body: +5% (round to nearest 2.5kg or 5kg plate)
```

### Rolling week boundaries

```
anchor = app_settings['first_workout_timestamp']
week_number = floor((current_timestamp - anchor) / 7_days)
week_start = anchor + (week_number * 7_days)
week_end = week_start + 7_days
```

## Data export

Support exporting all raw data as JSON:

```json
{
  "exported_at": "2026-02-11T12:00:00Z",
  "workouts": [...],
  "sets": [...],
  "exercises": [...],
  "exercise_muscle_mappings": [...],
  "bodyweight_log": [...]
}
```

This must work offline — write to the device's file system and share via the iOS share sheet.

## Migration strategy

Use a version number in `app_settings` (key: `schema_version`). On app launch, check the version and run any pending migrations sequentially. Never delete data in migrations — only add columns/tables or transform data non-destructively.
