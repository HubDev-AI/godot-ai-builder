# Roadmap: Complex Game Generation

The plugin builds simple games well (Asteroids). To handle complex games (heist planner, RPGs, multi-screen games), these improvements are needed.

## Problem Analysis

Why the heist planner failed:
1. **Scope explosion** — The builder tried to build everything in one session (city map, puzzle, results, shop, async PvP). Delivered nothing well.
2. **Asset blindness** — 18 PNG assets existed but the builder drew circles instead. The skills SAY "use assets" but don't ENFORCE it.
3. **Cascading errors** — Writing 10 scripts at once, all with errors, no way to get detailed error info. (Fixed with headless validation.)
4. **No incremental verification** — Built everything, tested nothing until the end.

## Task List

### Task 1: Requirements Distiller Skill (HIGH IMPACT)
**New skill: `godot-distiller`**

Takes complex user docs (GDD, PRD, feature lists) and produces a **single-session build plan** — a scoped subset that the builder can actually deliver in one session.

**What it does:**
- Reads all user docs (MVP.md, GAMEPLAY.md, etc.)
- Identifies the core gameplay loop (the ONE thing that makes the game fun)
- Strips everything else: no shops, no daily rewards, no async PvP, no social features
- Outputs a `SESSION_PLAN.md` with:
  - Exactly which features to build THIS session
  - A file manifest (max 12-15 scripts)
  - Which assets to use/generate
  - Clear "NOT building this session" list
- Supports multi-session: "Session 1: city map + building tap. Session 2: add puzzle. Session 3: add results + scoring."

**Why this matters:** The builder's biggest failure mode is trying to build a 3-month project in one session. The distiller prevents this by scoping aggressively.

**Files:**
- `skills/godot-distiller/SKILL.md` — the skill definition

### Task 2: Asset Pipeline Enforcement (HIGH IMPACT)
**Modify: `godot-director`, `godot-builder`, `godot-assets`**

Currently the skills say "use assets" but the builder ignores this. We need hard enforcement.

**Changes:**

In `godot-director` Phase 1 (Foundation), add a mandatory asset discovery step:
```
BEFORE writing any scripts:
1. Scan the docs folder for *.png, *.jpg, *.svg files
2. If assets found: copy them to res://assets/sprites/, list them in PRD
3. Map each asset to a game entity (bank.png → bank building, player.png → player)
4. Scripts MUST use Sprite2D + load(asset_path) for entities that have assets
5. Only use _draw() for entities WITHOUT assets
```

In `godot-builder` add a Rule 8:
```
Rule 8: ALWAYS Check for Existing Assets Before Drawing
Before writing any entity script:
1. Check if res://assets/sprites/ has a matching image
2. If yes: use Sprite2D with load()
3. If no: call godot_generate_asset() to create an SVG
4. NEVER use bare draw_circle() or draw_rect() as the primary visual
```

In `godot-assets`, add a concrete `_setup_entity_visual()` pattern that checks for sprites first, falls back to procedural, and NEVER leaves an entity invisible.

**Files:**
- `skills/godot-director/SKILL.md` — add asset discovery to Phase 0 and Phase 1
- `skills/godot-builder/SKILL.md` — add Rule 8
- `skills/godot-assets/SKILL.md` — add entity visual setup pattern

### Task 3: Smart Error Recovery (MEDIUM IMPACT)
**Modify: `godot-ops`, `godot-director`**

Now that `godot_get_errors` returns detailed messages with line numbers, update the skills to use this properly.

**Changes:**

In `godot-ops`, add error interpretation patterns:
```
Common GDScript errors and fixes:
- "Identifier not found: X" → Missing autoload, wrong class name, or typo
- "Invalid operands" → Type mismatch (int vs float, String vs int)
- "Parser Error: Expected X" → Syntax error (missing colon, bracket, etc.)
- "Cannot load source code" → File path wrong or file doesn't exist
- "Cyclic reference" → Two scripts import each other (use class_name carefully)
```

In `godot-director` Phase 6 (QA), update the error fix loop to use detailed errors:
```
errors = godot_get_errors()  // now returns line numbers + messages
for each error:
  Read ONLY the specific lines around error.line (not the whole file)
  The error.message tells you EXACTLY what's wrong
  Fix the specific issue
  Don't rewrite the whole file unless the error is architectural
```

**Files:**
- `skills/godot-ops/SKILL.md` — add error interpretation guide
- `skills/godot-director/SKILL.md` — update Phase 6 error loop

### Task 4: Progressive Build Protocol (MEDIUM IMPACT)
**Modify: `godot-director`**

Support multi-session builds where each session adds one layer of complexity.

**Changes:**

Add a "Session Scope" concept to the Director:
```
SESSION SCOPE RULES:
- Session 1: Core loop only. Player + one screen + basic mechanics. Max 8 scripts.
- Session 2: Add enemies/challenges. Max 5 new scripts.
- Session 3: Add UI screens (menu, HUD, game over). Max 5 new scripts.
- Session 4: Polish pass (effects, particles, audio, visual depth).
- Session 5+: Additional features (shop, progression, multiplayer, etc.)

Each session:
1. Read build_state.json to know what exists
2. List what was built in previous sessions
3. Add ONLY the new layer for this session
4. Verify previous features still work
5. Save updated build_state.json
```

This means the Director's 6 phases can span multiple Claude sessions. Phase 1 in session 1, Phases 2-3 in session 2, etc.

**Files:**
- `skills/godot-director/SKILL.md` — add session scope rules, modify phase execution

### Task 5: Incremental Verification (LOW-MEDIUM IMPACT)
**Modify: `godot-director`**

Enforce "write 2 scripts, test, fix, write 2 more" instead of "write 10 scripts, pray."

**Changes:**

The director already has Rule 6 ("Test after every 2-3 scripts") but it's buried and not enforced. Make it a HARD requirement in each phase:

```
PHASE EXECUTION PROTOCOL (applies to ALL phases):
1. Write script A
2. godot_reload_filesystem() + godot_get_errors()
3. Fix any errors in script A
4. Write script B
5. godot_reload_filesystem() + godot_get_errors()
6. Fix any errors in A or B
7. Continue...

NEVER write more than 2 scripts without checking errors.
If you write 3+ scripts without testing, you WILL get cascading errors.
```

**Files:**
- `skills/godot-director/SKILL.md` — promote incremental testing to top-level protocol

## Implementation Order

1. **Task 1 (Distiller)** — New skill, no existing changes needed. Highest impact.
2. **Task 2 (Assets)** — Edits to 3 existing skills. High impact.
3. **Task 3 (Errors)** — Edits to 2 existing skills. Leverages the headless validation we just built.
4. **Task 4 (Progressive)** — Edits to director skill. Enables complex games across sessions.
5. **Task 5 (Incremental)** — Small edits to director. Prevents cascading errors.

## Success Criteria

After these changes, the builder should be able to:
1. Take the heist planner docs and produce a scoped Session 1 plan (city map only)
2. Build that Session 1 with actual building sprites (not dots)
3. Get detailed errors and fix them without human help
4. Save state so Session 2 can add the puzzle mechanic
5. Each session produces a working, runnable game (not a broken prototype)
