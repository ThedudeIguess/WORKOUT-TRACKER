---
name: workout-logging-ux
description: >
  Use this skill whenever building or modifying the workout logging screens,
  the set input UI, exercise selection, rest timers, workout templates,
  or any screen the user interacts with during an active gym session.
  Also use for the PRS input, workout completion flow, and the home/dashboard screen.
  Do NOT use for volume calculations or database schema (see other skills).
---

# Workout Logging UX

## Design philosophy

This app is used at the gym between sets. The user has sweaty hands, limited attention,
and 60-120 seconds before the next set. Every interaction must be fast, large-tappable,
and require minimal typing.

## Home screen

Shows:
- Current rolling week number and date range
- Next workout day from the template (e.g., "Day 3 — Upper Pull A")
- Quick stats: workouts this week, total sets this week
- "Start Workout" button (large, prominent)

If a workout is in progress (started but not completed), show "Resume Workout" instead.

## Start workout flow

1. User taps "Start Workout"
2. App shows the next day template (auto-detected from the last completed day)
   - User can override and pick a different day if needed
3. PRS input: "How recovered do you feel? (0-10)" — large number selector, single tap
   - Optional bodyweight input field (kg, one decimal)
4. App loads the day's exercises from the template
5. Workout timer starts (elapsed time shown in header)

## Active workout screen

### Layout (top to bottom)
- Header: Day name, elapsed time, "Finish" button
- Scrollable list of exercises in template order
- Each exercise is an expandable card

### Exercise card (collapsed)
- Exercise name
- Set summary (e.g., "2/2 sets done")
- Tap to expand

### Exercise card (expanded)
- Exercise name with swap icon (to pick an alternate)
- Target: "2 sets × 6-10 reps" (from template)
- Notes from template (e.g., "slow 3s eccentric")
- List of logged sets
- "Add Set" button

### Set input row
Each set shows:
- **Set number** (auto-incremented)
- **Load input** (kg): numeric keypad, large font. Default to last session's load for this exercise.
- **Reps input**: numeric keypad, large font. Default empty (must type).
- **Effort label**: four large buttons in a row — Easy | Productive | Hard | Failure
  - Only one can be selected (radio behavior)
  - Default: none selected (must pick one)
  - Color coding: Easy=gray, Productive=blue, Hard=orange, Failure=red
- **Warmup toggle**: small checkbox. If checked, set is excluded from volume calculations.
- **Confirm button**: locks the set and moves to next

Once confirmed, a set row becomes read-only with a muted appearance. Tap to edit (unlock).

### Exercise swap flow
When user taps the swap icon on an exercise:
1. Show a bottom sheet listing alternate exercises for that slot
2. User taps one → exercise name updates, load defaults update
3. Alternates come from `slot_alternate_exercises` table

### Rest timer
After confirming a set, a rest timer starts automatically.
- Countdown from the template's `rest_seconds` value (default 90s)
- Shows as a notification-bar at the top or bottom of the screen
- Timer can be dismissed, paused, or reset
- Optional: vibration/notification when timer hits 0

## Load defaults and smart suggestions

### Previous load
When starting a set for an exercise, auto-fill the load field with the load used on
the most recent session for the same exercise. If no history exists, leave blank.

### Progression suggestion
If the ACSM double progression condition is met (hit top of rep range on both sets
in the previous two sessions), show a subtle banner above the exercise:
"💪 Progress: try [calculated_new_load] kg"

The user can ignore this — it's informational, not enforced.

## Finish workout flow

1. User taps "Finish" in the header
2. App shows a summary:
   - Duration
   - Total sets logged
   - Exercises completed
   - Any exercises with 0 sets (warning)
3. Optional notes field (free text)
4. "Save Workout" button
5. Workout is marked as completed (completed_at timestamp set)
6. Return to home screen

## Workout history screen

Reverse chronological list of completed workouts.
Each row shows: date, day name, duration, total sets, PRS score.
Tap to view full workout details (read-only version of the active workout screen).

## Key UX rules

1. **Never lose data.** Sets are written to SQLite the moment they're confirmed, not when the workout is "saved." If the app crashes mid-workout, all confirmed sets are preserved.
2. **Big tap targets.** All interactive elements must be at least 44×44 points (Apple HIG minimum). Effort labels should be even larger.
3. **Minimal typing.** Load and reps are the only typed inputs. Everything else is taps.
4. **No modals for critical actions.** Exercise swap uses a bottom sheet, not a modal. Effort selection is inline, not a popup.
5. **Dark mode by default.** Most gyms have dim lighting. White backgrounds are blinding. Use a dark theme with high-contrast text.
6. **No internet dependency.** Every screen must work with zero network connectivity.
