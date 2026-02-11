# Workout Tracker — AGENTS.md

## Project overview

A personal workout tracking app for a single user running Eugene Teo's Hybrid Bodybuilding 2.0 program. The app logs sets at the gym, calculates weekly volume per muscle group using a research-backed credit system, tracks strength progression, and monitors recovery readiness.

This is a **personal-use app** — no backend server, no user accounts, no cloud sync. All data lives in SQLite on the device.

## Tech stack

- **Framework:** React Native with Expo (managed workflow), TypeScript strict mode
- **Database:** expo-sqlite (local only, on-device)
- **State management:** Zustand (no Redux, no MobX, no Context-heavy patterns)
- **Navigation:** expo-router (file-based routing)
- **Styling:** React Native StyleSheet (no Tailwind, no styled-components, no NativeWind)
- **Testing:** Jest + React Native Testing Library
- **Build:** Expo CLI, EAS Build for device installs

## Project structure

```
workout-tracker/
├── AGENTS.md                     # This file
├── app.json                      # Expo config
├── tsconfig.json
├── package.json
├── .agents/
│   └── skills/                   # Codex skills for this project
│       ├── data-model/
│       │   └── SKILL.md
│       ├── credit-system/
│       │   └── SKILL.md
│       └── logging-ux/
│           └── SKILL.md
├── src/
│   ├── app/                      # expo-router screens (file-based routing)
│   │   ├── _layout.tsx           # Root layout
│   │   ├── index.tsx             # Home / dashboard
│   │   ├── workout/
│   │   │   ├── [dayId].tsx       # Active workout logging screen
│   │   │   └── history.tsx       # Past workouts
│   │   ├── progress/
│   │   │   ├── volume.tsx        # Weekly volume per muscle group
│   │   │   ├── strength.tsx      # 1RM trends
│   │   │   └── body-map.tsx      # Visual muscle map (Phase 4)
│   │   └── settings/
│   │       ├── index.tsx         # Settings home
│   │       ├── exercises.tsx     # Exercise library editor
│   │       └── program.tsx       # Program/phase management
│   ├── db/
│   │   ├── schema.ts             # SQLite table definitions + migrations
│   │   ├── queries.ts            # All database read/write functions
│   │   └── seed.ts               # Pre-load exercise library + program templates
│   ├── stores/
│   │   ├── workoutStore.ts       # Active workout session state (Zustand)
│   │   └── settingsStore.ts      # User preferences
│   ├── utils/
│   │   ├── volumeCalculator.ts   # Weekly volume computation (direct/indirect credit)
│   │   ├── progressionEngine.ts  # ACSM double progression logic
│   │   ├── oneRepMax.ts          # Epley formula
│   │   └── rollingWeek.ts        # Rolling week date math
│   ├── types/
│   │   └── index.ts              # All TypeScript type definitions
│   ├── constants/
│   │   ├── exercises.ts          # Global exercise library with muscle mappings
│   │   ├── mevThresholds.ts      # MEV/optimal/MRV per muscle group
│   │   └── programTemplates.ts   # Hybrid BB Phase 1 day templates
│   └── components/
│       ├── SetRow.tsx             # Single set input (reps, load, label)
│       ├── ExerciseCard.tsx       # Exercise within a workout
│       ├── MuscleBar.tsx          # Color-coded volume bar for one muscle
│       ├── PrsInput.tsx           # Pre-workout PRS 0-10 score
│       └── ProgressChart.tsx      # Line chart for strength trends
└── __tests__/
    ├── volumeCalculator.test.ts
    ├── progressionEngine.test.ts
    └── rollingWeek.test.ts
```

## Architecture rules

1. **Raw data forever.** Store every set exactly as logged: exercise_id, reps, load_kg, effort_label, timestamp. Never overwrite or aggregate raw data.

2. **Derived views are computed, not stored.** Weekly volume, effective sets, muscle group totals, color zones — all computed at read time from raw data. If the computation logic changes, raw data stays intact and views recompute.

3. **SQLite is the source of truth.** Zustand stores hold transient UI state only (the current workout session being logged). Anything that must persist goes to SQLite immediately.

4. **Offline-only.** No network calls, no API endpoints, no Supabase, no Firebase. The app works with zero internet. Data export (JSON/CSV) is the backup strategy.

5. **No fake precision.** The credit system uses two tiers (direct = 1.0, indirect = 0.5) — not multi-decimal splits. Volume thresholds are ranges, not exact numbers.

## How to run

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run tests
npx jest

# Build standalone app for iPhone (requires Xcode)
npx expo run:ios --device
```

## Coding conventions

- All files use TypeScript with strict mode enabled
- Functions over classes. Use hooks and functional components only.
- Database functions in `src/db/queries.ts` are the only code that touches SQLite directly
- Every utility function (`volumeCalculator`, `progressionEngine`, etc.) must have unit tests
- No `any` types. If the type is complex, define it in `src/types/index.ts`
- Use descriptive variable names. `exerciseId` not `eid`. `effectiveSets` not `es`.
- Error handling: wrap all SQLite operations in try/catch. Surface errors to the UI, don't swallow them silently.
- Comments: explain WHY, not WHAT. The code should be readable on its own.

## Key domain concepts (read the skills for full detail)

- **Direct set:** The tracked muscle is the primary mover. Credit = 1.0.
- **Indirect set:** The tracked muscle is a meaningful synergist. Credit = 0.5.
- **Effort gate:** A set counts fully only if labeled "productive", "hard", or "failure." Sets labeled "easy" count at 0.5.
- **MEV (Minimum Effective Volume):** Lowest weekly sets for measurable hypertrophy. Varies by muscle group. Research-backed ranges in `mevThresholds.ts`.
- **Rolling week:** Starts from the timestamp of the user's first-ever workout. Week boundaries are every 7 days from that anchor. Empty weeks are tracked (for detraining detection).
- **ACSM double progression:** If the user hits the top of the rep range on both sets for the same exercise on two consecutive exposures → suggest load increase (2-5% upper body, 5-10% lower body).
- **PRS (Perceived Recovery Status):** 0-10 scale logged before each workout. Stored as raw data for trend analysis.
