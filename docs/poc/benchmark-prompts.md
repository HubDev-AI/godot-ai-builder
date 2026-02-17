# PoC Benchmark Prompt Set (Locked)

## Purpose

This is the fixed prompt set for Phase 0 PoC validation.
Do not rewrite these prompts during PoC runs.

## Run Rules

1. Use full game mode (6-phase build).
2. Use the same model/settings for all 3 runs.
3. Allow at most 3 quality-improvement loops per run.
4. Keep prompts exactly as written below.
5. Save quality artifacts after each run in `res://.claude/quality_reports/`.

## Prompt 01: Neon Ruins Arena

Build a complete top-down arena action game in Godot 4.

Theme and look:
- Visual direction: "neon ruins overgrown by moss"
- Distinct palette with one strong accent color
- Strong depth layering (background, playfield, foreground FX)
- Clear combat feedback (hit, death, pickup, ability)

Gameplay requirements:
- Player movement + primary attack + one mobility ability
- At least 3 enemy behaviors that feel different in play
- At least 3 player upgrade choices that change playstyle
- Escalating pressure over time (waves or equivalent)

Flow requirements:
- Main menu, gameplay, game over/win state
- Restart and return-to-menu paths
- No placeholder TODO/pass behavior in gameplay-critical scripts

Quality target:
- Prioritize game feel, visual readability, and cohesive style over raw feature count.

## Prompt 02: Volcanic Forge Arena

Build a complete top-down arena action game in Godot 4.

Theme and look:
- Visual direction: "volcanic forge and ash storms"
- Cohesive warm palette with controlled contrast
- Intentional depth with layered environment elements
- Distinct visual cues for damage, pickups, and abilities

Gameplay requirements:
- Player movement + primary attack + one mobility or defense ability
- At least 3 enemy behavior patterns (not stat-only clones)
- At least 3 upgrade choices with different strategic value
- Tension curve that ramps clearly during a run

Flow requirements:
- Menu -> gameplay -> game over/win -> restart/menu
- HUD with readable health/status/score signals
- No fake completion while errors remain

Quality target:
- Prioritize meaningful presentation and encounter variety, not tutorial-style defaults.

## Prompt 03: Frozen Observatory Arena

Build a complete top-down arena action game in Godot 4.

Theme and look:
- Visual direction: "frozen observatory under aurora sky"
- Tight palette discipline and clear silhouettes
- Layered scene composition with atmospheric polish
- Event feedback for hit, death, pickup, and ability usage

Gameplay requirements:
- Player movement + primary attack + one active ability
- At least 3 enemy behavior archetypes
- At least 3 upgrade/build choices that alter strategy
- Progressive challenge scaling across the run

Flow requirements:
- Working start menu, gameplay loop, and end-state handling
- Restart and menu return from end-state
- No unresolved critical warnings/errors

Quality target:
- Deliver a playable, polished result that does not resemble a tutorial starter project.
