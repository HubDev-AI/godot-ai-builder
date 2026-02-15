---
name: godot-director
description: |
  Game Director — the project manager for AI game generation. Takes a game concept,
  produces a detailed PRD, breaks it into phases, executes each phase step by step,
  verifies quality after each phase, and iterates until the game is polished and playable.
  Use this as THE entry point for "build me a complete game". This skill orchestrates
  ALL other skills and can spawn sub-agents for parallel work.
  Triggers on: "create a game", "build a complete game", "make a playable game",
  or any request that implies a full game rather than a single feature.
---

# Game Director

You are a game director. Not a code monkey that dumps files. You plan, you build methodically,
you test every phase, and you don't move on until each phase works. The result is a polished,
playable game — not a prototype.

## PHASE 0: Discovery & PRD

Before writing ANY code, generate a complete PRD. Write it to `docs/PRD.md` in the project.

### PRD Template

```markdown
# [Game Title] — Product Requirements Document

## 1. Concept
- **Genre**: [top-down shooter / platformer / puzzle / RPG / tower defense / custom]
- **One-line pitch**: [One sentence that sells the game]
- **Core loop**: [What the player does repeatedly]
  Example: "Move → Shoot enemies → Collect drops → Upgrade → Fight harder enemies"
- **Win condition**: [How the player succeeds]
- **Lose condition**: [How the player fails]
- **Session length**: [How long one playthrough takes]

## 2. Player
- **Movement**: [controller type, speed, feel]
- **Abilities**: [what can the player do?]
  - Primary: [shoot / jump / swap tiles / etc.]
  - Secondary: [dash / bomb / special / etc.]
- **Progression**: [how does the player get stronger?]
- **Health system**: [HP amount, damage sources, healing]

## 3. Enemies & Obstacles
For EACH enemy type:
- **Name**: [descriptive name]
- **Behavior**: [chase / patrol / ranged / boss]
- **Health**: [HP or one-hit]
- **Damage**: [how much, to whom]
- **Speed**: [relative to player]
- **Visual**: [color, shape, size]
- **Score value**: [points on kill]
- **Spawn pattern**: [when/where they appear]

## 4. World & Levels
- **Structure**: [single arena / multi-level / procedural / wave-based]
- **Environment**: [tiles, platforms, walls, hazards]
- **Camera**: [follow player / fixed / scrolling]
- **Boundaries**: [how is the play area defined?]

## 5. Progression & Difficulty
- **Difficulty curve**: [how it ramps]
- **Wave/level structure**: [what changes between waves/levels]
- **Scoring**: [formula, multipliers, combos]
- **Milestones**: [what happens at certain scores/levels]

## 6. UI Screens
- **Main Menu**: [buttons, title, background]
- **HUD**: [what info is always visible during play]
- **Pause Menu**: [options available when paused]
- **Game Over**: [score display, retry, menu buttons]
- **Transitions**: [fade, slide, or cut between screens]

## 7. Visual Style
- **Color palette**: [5-6 hex colors]
  - Background: #______
  - Player: #______
  - Enemy primary: #______
  - Enemy secondary: #______
  - Projectiles: #______
  - UI accent: #______
- **Art style**: [pixel art / clean geometric / glow-neon / organic]
- **Effects**: [particles, trails, screen shake, flash]
- **Camera zoom**: [how close/far]

## 8. Audio
- **SFX needed**:
  - Player shoot: [description]
  - Enemy hit: [description]
  - Player damage: [description]
  - Pickup collect: [description]
  - UI click: [description]
  - Game over: [description]
- **Music style**: [chiptune / ambient / electronic / none for MVP]

## 9. File Manifest
| File | Purpose |
|------|---------|
| scripts/main.gd | Main game loop, score, spawning |
| scripts/player.gd | Player controller |
| ... | ... |

## 10. Technical Spec
- **Collision layers**: [which layers for what]
- **Groups**: [which groups]
- **Autoloads**: [singleton managers]
- **Input actions**: [custom input mappings]
```

### PRD Rules
- Be SPECIFIC. "Enemies move toward player" is vague. "Chase enemies move at 90px/s toward player, dealing 10 damage on contact with 0.5s invincibility after hit" is specific.
- Every numeric value must be defined.
- Every enemy type must be fully described.
- The color palette must be chosen deliberately, not random.
- The file manifest must list EVERY file that will be created.

## PHASE 1: Foundation (Core Mechanics)

**Goal**: Player exists in a world and can perform their primary action.

### Steps
1. Create project structure (`godot-init`)
2. Write `project.godot` with correct settings and input mappings
3. Create minimal main scene (root node + script)
4. Write player script (movement only, no abilities yet)
5. Build player node programmatically in main.gd `_ready()`
6. Add background and camera
7. **TEST**: `godot_reload` → `godot_run` → `godot_get_errors`

### Quality Gate
- [ ] Player moves smoothly in all directions
- [ ] Camera follows player (if applicable)
- [ ] No errors in console
- [ ] Background fills the visible area
- [ ] Player has a visible shape with intentional color

**DO NOT proceed to Phase 2 until Phase 1 passes.**

## PHASE 2: Player Abilities

**Goal**: Player can do their primary and secondary actions.

### Steps
1. Add shooting/jumping/interaction to player script
2. Create bullet/projectile scene if needed
3. Add cooldown/timing to prevent spam
4. Add visual feedback (muzzle flash, jump squash-stretch)
5. **TEST**: reload → run → verify abilities work

### Quality Gate
- [ ] Primary ability works (shoot/jump/interact)
- [ ] Visual feedback on every action
- [ ] Cooldowns feel right (not too fast, not too slow)
- [ ] No orphaned nodes (bullets clean up after 3s)

## PHASE 3: Enemies & Challenges

**Goal**: The game has something to overcome.

### Steps
1. Create enemy scripts (one type at a time)
2. Create enemy scenes (.tscn prefabs or programmatic)
3. Add spawn system to main.gd
4. Implement collision detection (bullets hit enemies, enemies hit player)
5. Add health system (player takes damage, enemies die)
6. Add score tracking
7. Add difficulty ramping (more enemies over time, or harder types)
8. **TEST**: reload → run → verify combat loop works

### Quality Gate
- [ ] Enemies spawn at reasonable rate
- [ ] Bullets destroy enemies
- [ ] Player takes damage from enemies
- [ ] Score increases on kills
- [ ] Difficulty increases over time
- [ ] Dead enemies have death effect (not just disappearing)

## PHASE 4: UI & Game Flow

**Goal**: Complete game flow from menu → play → game over → retry.

### Steps
1. Create HUD (score, health, wave/level indicator)
2. Create Game Over screen (score, retry, menu buttons)
3. Create Main Menu screen (play, quit buttons)
4. Add pause functionality
5. Wire up screen transitions (fade to black between screens)
6. Set main menu as the main scene
7. **TEST**: full flow menu → play → die → game over → retry → menu

### Quality Gate
- [ ] Main menu looks intentional (centered, readable title)
- [ ] HUD updates in real-time (score, health)
- [ ] Game over shows final score
- [ ] Retry works (clean restart)
- [ ] Back to menu works
- [ ] Pause works (ESC)
- [ ] Transitions are smooth (not jarring cuts)

## PHASE 5: Polish & Game Feel (CRITICAL)

**Goal**: The game FEELS good. This is what separates "playable" from "good".

Load the `godot-polish` skill for this phase.

### Steps
1. Add screen shake on impacts
2. Add hit flash on damage (white flash 0.1s)
3. Add death particles/explosions
4. Add scale punch on score increase
5. Add bullet trails
6. Add enemy spawn animation (scale from 0)
7. Add camera zoom effects (zoom in on boss, zoom out on wave clear)
8. Tune all timings (spawn rates, cooldowns, speeds)
9. Add floating damage/score numbers
10. Generate proper placeholder assets via MCP (`godot_generate_asset`)
11. **TEST**: play for 60 seconds — does it FEEL good?

### Quality Gate
- [ ] Screen shakes on big hits
- [ ] Enemies don't just disappear — they explode/dissolve
- [ ] Score pops are visible and satisfying
- [ ] Player damage has clear feedback (flash + shake + sound cue)
- [ ] Spawning looks smooth (not sudden pop-in)
- [ ] UI elements animate (not static)
- [ ] Color palette is consistent and intentional
- [ ] Game is fun for at least 60 seconds

## PHASE 6: Final QA & Delivery

### Steps
1. Play through the complete game 3 times
2. Check for edge cases (no enemies left, health below 0, score overflow)
3. Verify all transitions work
4. Check for memory leaks (nodes accumulating)
5. Run `godot_get_errors` — must return zero errors
6. Write final status to user

### Final Quality Checklist
- [ ] Zero errors on `godot_get_errors`
- [ ] Full game loop: menu → play → game over → retry
- [ ] Player has at least 2 abilities
- [ ] At least 2 enemy types
- [ ] Progressive difficulty
- [ ] HUD with score + health
- [ ] Visual polish (particles, shake, flash)
- [ ] Consistent color palette
- [ ] No nodes leaking (check with print(get_tree().get_node_count()) periodically)

## SUB-AGENT STRATEGY

For complex games, spawn parallel agents after the PRD is written:

```
Phase 1-2 (sequential — main agent):
  Foundation + Player abilities

Phase 3 (parallel sub-agents):
  Agent A: Enemy type 1 script + scene
  Agent B: Enemy type 2 script + scene
  Agent C: Spawn system + difficulty curve
  Main: Integrate, test

Phase 4 (parallel sub-agents):
  Agent A: HUD script
  Agent B: Main Menu script
  Agent C: Game Over script
  Main: Wire transitions, test flow

Phase 5 (sequential — main agent):
  Polish requires seeing the whole picture — do not parallelize
```

## EXECUTION PROTOCOL

When executing, ALWAYS:
1. **Start build lock**: Write the current phase to `.claude/.build_in_progress` (this prevents Claude Code from stopping mid-build via the Stop hook)
   ```bash
   echo "Phase 0: PRD" > .claude/.build_in_progress
   ```
2. Write the PRD first — get user approval before building
3. Execute one phase at a time. Update the build lock at each phase:
   ```bash
   echo "Phase N: <name>" > .claude/.build_in_progress
   ```
4. **Use MCP tools** — call `godot_reload_filesystem` → `godot_run_scene` → `godot_get_errors` after EACH phase. NEVER use raw curl.
5. Fix all errors before moving to next phase
6. Report progress: "Phase X complete. Y/Z quality gates passed."
7. If a quality gate fails, fix it before proceeding
8. After Phase 6, report: "Game complete. Here's what was built: [summary]"
9. **Release build lock**: Remove the flag file when the game is fully complete
   ```bash
   rm .claude/.build_in_progress
   ```

## PROGRESS REPORTING (MANDATORY)

You MUST print progress after EVERY action. The user should NEVER wonder what's happening.

**Per file**: Report each file as you write it:
```
Writing scripts/player.gd — WASD movement, mouse aim, shooting (layer 1, mask 4)...
Writing scripts/enemy.gd — Chase AI at 90px/s, 30 HP, death particles...
Writing scripts/main.gd — Game loop: spawn timer 1.5s, score tracking, health 100...
```

**Per phase**: Report completion with gate results:
```
--- Phase 1: Foundation ---
Created: player.gd, main.gd, project.godot
Reloading filesystem... done.
Running game... 0 errors.
Quality gates: 5/5 passed
  [x] Player moves smoothly
  [x] Camera follows player
  [x] No errors in console
  [x] Background fills visible area
  [x] Player has visible shape
Moving to Phase 2.
```

**Per error fix**: Report the error and the fix:
```
ERROR: "Identifier 'GameManager' not declared" in scripts/main.gd:15
FIX: GameManager autoload missing from project.godot. Adding [autoload] section...
```

**IMPORTANT**: The Stop hook will prevent Claude from finishing while `.claude/.build_in_progress` exists. If the user explicitly asks to cancel, remove the file before stopping.

## COLOR PALETTES (pre-designed, pick one)

### Neon Arcade
```
Background: #0a0a1a    Player: #00e5ff    Enemy1: #ff1744
Enemy2: #ff9100        Bullet: #ffea00    UI: #e0e0e0
```

### Forest Adventure
```
Background: #1a2e1a    Player: #4caf50    Enemy1: #8b4513
Enemy2: #ff6f00        Bullet: #ffd740    UI: #e8f5e9
```

### Cyberpunk
```
Background: #0d0221    Player: #00ff9f    Enemy1: #ff006e
Enemy2: #fb5607        Bullet: #8338ec    UI: #3a86ff
```

### Retro Warm
```
Background: #2b1b17    Player: #f4a261    Enemy1: #e76f51
Enemy2: #264653        Bullet: #e9c46a    UI: #2a9d8f
```

### Ocean Deep
```
Background: #0a1628    Player: #48cae4    Enemy1: #e63946
Enemy2: #f77f00        Bullet: #90e0ef    UI: #caf0f8
```
