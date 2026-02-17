# PoC Evaluator Checklist

## Usage

Use this checklist after each PoC benchmark run.
If any hard gate fails, the run is an automatic fail regardless of score.

## 1) Hard Gates (All Required)

1. `zero_script_errors`: no script/compiler errors at completion.
2. `no_critical_warnings`: no critical warnings blocking normal play.
3. `play_loop_complete`: menu -> gameplay -> win/lose -> restart/menu works.
4. `controls_clear`: controls are responsive and communicated in-game.
5. `no_soft_lock`: no dead-end/soft-lock during a 10-minute play session.
6. `quality_gates_passed`: objective late-phase quality gates pass.

## 2) Anti-Tutorial Visual Checks (All Required)

1. `named_art_direction`: game has a clear named visual direction.
2. `palette_discipline`: palette is coherent and intentionally constrained.
3. `silhouette_readability`: player/enemy/hazard readable at gameplay speed.
4. `layering_depth`: scene shows purposeful depth/layer composition.
5. `feedback_clarity`: hit/death/pickup/ability events are visually distinct.
6. `ui_theme_consistency`: HUD/menu style matches game style.
7. `no_raw_placeholder_feel`: output does not look like default template art/UI.

## 3) Weighted Category Scores (1-5)

Score each category from 1 to 5:

1. `core_loop_fun` (weight 20)
2. `controls_game_feel` (weight 20)
3. `progression_variety` (weight 20)
4. `encounter_depth` (weight 15)
5. `visual_polish_cohesion` (weight 15)
6. `ux_onboarding_feedback` (weight 10)

## 4) Category Anchors

Use these anchors for consistency:

1. `1`: poor / clearly broken expectations
2. `2`: weak / mostly tutorial baseline
3. `3`: acceptable / functional but not standout
4. `4`: strong / polished and cohesive
5. `5`: excellent / memorable and highly coherent

## 5) Pass Rules

Run passes only if all are true:

1. All hard gates pass.
2. All anti-tutorial visual checks pass.
3. Weighted total score >= 80.
4. No category below 3.
5. At least two categories >= 4.
6. `visual_polish_cohesion >= 4`.

## 6) Very Good Rules

Mark `very_good_status=true` only if all are true:

1. Weighted total score >= 85.
2. `controls_game_feel >= 4`.
3. `progression_variety >= 4`.
4. `visual_polish_cohesion >= 4`.
5. At least two signature moments are recorded.
