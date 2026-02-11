---
name: exercise-credit-system
description: >
  Use this skill whenever computing effective sets, weekly volume per muscle group,
  MEV/optimal/MRV zone assignments, or anything related to how sets translate into
  hypertrophy credit. Also use when building the volume dashboard, muscle map, or
  any visualization of training volume. Do NOT use for workout logging UI or
  database schema (see data-model skill for schema).
---

# Exercise Credit System

## Research basis

This system is built on Pelland et al. 2024 (Sports Medicine, PMID 41343037), a 67-study
meta-regression of 2,058 participants. Key finding: counting indirect sets at 0.5× direct sets
(the "fractional" method) was the best-fit model for predicting hypertrophy, with a Bayes
Factor of 9.48 over counting all sets equally.

The actual contribution of an indirect set was approximated at ~32% of a direct set for
hypertrophy. The 0.5 value is the best discrete option tested. For app purposes, 0.5 is
a reasonable and research-supported default.

## Credit rules

### Rule 1: Role-based credit (HIGH evidence)

Every exercise-muscle pairing has a role: `direct` or `indirect`.

- **Direct** (muscle is the primary mover): credit = **1.0 per set**
- **Indirect** (muscle is a meaningful synergist): credit = **0.5 per set**

There is no 0.25, 0.35, or 0.65. Two tiers only.

### Rule 2: Effort gate (MEDIUM evidence)

Not all sets are equal. A set only gets full credit if it was hard enough to stimulate growth.

- **"productive" / "hard" / "failure"**: effort multiplier = **1.0**
- **"easy"**: effort multiplier = **0.5**
- **Warmup sets** (is_warmup = true): effort multiplier = **0.0** (never count)

### Rule 3: MetCon discount (LOW evidence, pragmatic)

Conditioning exercises (box step-overs, hill sprints, carries, plyometrics) get a flat
discount multiplier because stimulus is less targeted and more variable than controlled
resistance work.

- **Box step-overs, carries (RPE 8-9 conditioning):** discount = **0.35**
- **Hill sprints:** discount = **0.20**
- **Plyometrics (broad jumps, BSS hops):** discount = **0.10**

MetCon discount is applied ON TOP of the role credit and effort gate:
`effective_credit = role_credit × effort_multiplier × metcon_discount`

For non-metcon exercises, metcon_discount = 1.0 (no discount).

### Effective credit formula

```
effective_credit = role_credit × effort_multiplier × metcon_discount

Where:
  role_credit = 1.0 (direct) or 0.5 (indirect)
  effort_multiplier = 1.0 (productive/hard/failure) or 0.5 (easy) or 0.0 (warmup)
  metcon_discount = 1.0 (normal exercises) or exercise-specific discount (metcon)
```

## Exercise-to-muscle mapping (Hybrid BB 2.0 Phase 1)

Format: Exercise → Muscle (role)

### Day 1 — Lower A
- Broad jumps → Quads (direct), Glutes (direct) | metcon_discount: 0.10
- Barbell back squat → Quads (direct), Glutes (direct)
- Seated leg curl → Hamstrings (direct)
- GHD/Hanging knee raise → Abs (direct)
- Wall hip flexor stretch → [no credit, mobility]

### Day 2 — Upper Push A
- Barbell bench press → Chest (direct), Triceps (indirect), Front delts (indirect)
- Assisted dips → Triceps (direct), Chest (direct)
- Cable lateral raise → Side delts (direct)
- Preacher curl (EZ) → Biceps (direct)
- Dead hang (passive) → Forearms (direct) [not counted toward hypertrophy volume by default]

### Day 3 — Upper Pull A
- Rack/assisted chin-up → Lats (direct), Biceps (indirect)
- Seated cable row / machine row → Upper back (direct), Lats (indirect), Biceps (indirect)
- Cable Y-raise → Lower traps (direct), Rear delts (direct)
- Triceps extension → Triceps (direct)
- Box step-overs → Quads (direct), Glutes (direct) | metcon_discount: 0.35
- QL walk (carry) → Obliques (direct), Forearms (direct) | metcon_discount: 0.30

### Day 4 — Lower B
- BSS hops → Quads (direct), Glutes (direct) | metcon_discount: 0.10
- Bulgarian split squat (slow ecc) → Quads (direct), Glutes (direct)
- Single-leg stiff-leg deadlift → Hamstrings (direct), Glutes (direct)
- Leg extension → Quads (direct)
- Mobility MetCon → [no credit]

### Day 5 — Upper Push B
- DB incline press → Chest (direct), Triceps (indirect), Front delts (indirect)
- Cable crossover → Chest (direct)
- Side-lying lateral raise → Side delts (direct)
- Barbell or DB curl → Biceps (direct)
- Dead hang (passive) → [same as Day 2]

### Day 6 — Upper Pull B
- Lat pulldown → Lats (direct), Biceps (indirect)
- Inverted row → Upper back (direct), Biceps (indirect), Lats (indirect)
- OR Machine row → Upper back (direct), Lats (indirect), Biceps (indirect)
- Rear delt fly → Rear delts (direct), Upper back (indirect)
- Triceps extension → Triceps (direct)
- Hill sprints → Glutes (direct), Hamstrings (direct) | metcon_discount: 0.20

## Volume thresholds (research-backed, novice male defaults)

Source: Deep research synthesis of Mitchell 2012, Sooneste 2013, Radaelli 2015,
Schoenfeld 2017 meta-analysis, plus novice-specific calibration.

| Muscle group | MEV (sets/wk) | Optimal (sets/wk) | MRV (sets/wk) | Evidence |
|---|---|---|---|---|
| Quads | 3–6 | 6–10+ | 10–16 | MEDIUM |
| Hamstrings | 3–6 | 6–10+ | 10–16 | LOW-MEDIUM |
| Glutes | 3–6 | 6–10+ | 10–16 | LOW |
| Chest | 2–4 | 6–10+ | 10–16 | LOW |
| Lats | 2–4 | 6–10+ | 10–16 | LOW |
| Upper back | 2–4 | 6–10+ | 10–16 | LOW |
| Side delts | 2–4 | 6–10 | 10–14 | LOW |
| Rear delts | 2–4 | 6–10 | 10–14 | LOW |
| Front delts | 2–4 | 6–10 | 10–14 | LOW |
| Biceps | 2–4 | 4–8 (up to 10) | 10–14 | MEDIUM |
| Triceps | 3–6 | 6–10+ | 10–14 | LOW-MEDIUM |
| Abs | 2–4 | 4–8 | 8–14 | LOW |
| Lower traps | 2–4 | 4–8 | 8–14 | LOW |
| Forearms | 2–4 | 4–8 | 8–14 | LOW |

## Zone assignment logic

```
if effective_sets < mev_low:
    zone = "RED"       // Under-dosed
elif effective_sets < optimal_low:
    zone = "YELLOW"    // Meeting MEV, room to grow
elif effective_sets <= optimal_high:
    zone = "GREEN"     // Optimal range
elif effective_sets <= mrv_high:
    zone = "AMBER"     // High volume, watch fatigue
else:
    zone = "ORANGE"    // Likely exceeding MRV
```

## What NOT to build

- Do NOT implement per-set decimal splits (0.65 quads, 0.35 glutes). Use direct/indirect only.
- Do NOT implement RIR-to-credit curves (RIR 0→1.0, RIR 2→0.8, etc.). Use the label-based effort gate.
- Do NOT implement technique multipliers (0.85 for "breakdown form"). Not validated.
- Do NOT implement EMG-based weighting. EMG ≠ hypertrophy stimulus.
- Do NOT show volume numbers with more than one decimal place. Round to nearest 0.5.
