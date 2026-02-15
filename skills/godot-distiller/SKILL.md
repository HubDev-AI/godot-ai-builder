---
name: godot-distiller
description: |
  Requirements Distiller — takes complex game design documents (GDDs, PRDs, feature lists)
  and produces a scoped, single-session build plan that the builder can actually deliver.
  Prevents scope explosion by identifying the core gameplay loop and stripping everything else.
  Triggers on: "distill", "scope", "session plan", or when the builder detects complex multi-doc input.
---

# Requirements Distiller

## Purpose

Complex game designs (heist planners, RPGs, multi-screen games) have dozens of features.
The builder's biggest failure mode is trying to build ALL of them in one session — delivering
nothing well. The distiller prevents this by producing a **focused, single-session build plan**
that contains ONLY what can realistically be built and tested in one Claude session.

## When This Skill Activates

- User provides a folder with multiple design documents
- User provides a GDD/PRD with more than 3 screens or 15+ features
- The builder detects the scope exceeds a single-session capacity (~12-15 scripts)
- User explicitly asks to "distill", "scope", or "plan sessions"

## The Distillation Process

### Step 1: Read Everything

Read ALL documents in the user's folder:
```
Glob: <docs-folder>/**/*.md, **/*.txt, **/*.json, **/*.yaml
Also: **/*.png, **/*.jpg (note as art assets)
```

For each document, extract:
- **Features**: Every distinct feature mentioned (list them ALL)
- **Screens/Scenes**: Every UI screen or game scene described
- **Entities**: Every game entity (player types, enemies, items, buildings, etc.)
- **Systems**: Every backend system (scoring, progression, energy, currency, PvP, etc.)
- **Assets**: Every art asset mentioned or found in the folder

### Step 2: Identify the Core Loop

The core gameplay loop is the ONE thing that makes the game fun.
Strip away everything that is not essential to experiencing this loop.

**Questions to ask:**
1. What does the player DO most of the time? (This is the core mechanic)
2. What is the minimum set of entities needed for that mechanic to work?
3. What is the simplest win/lose condition?
4. What is ONE screen where all of this happens?

**Examples:**
| Game Concept | Core Loop | NOT Core |
|---|---|---|
| Heist planner | Tap building → solve puzzle → get loot | Shop, daily rewards, PvP, guilds, leaderboards |
| Match-3 RPG | Match tiles → damage enemies → level up | Gacha, social features, events, territories |
| Tower defense | Place towers → waves attack → upgrade | Story mode, multiplayer, achievements |
| City builder | Place buildings → earn resources → expand | Trading, diplomacy, war, quests |

### Step 3: Scope Into Sessions

Each session can realistically produce:
- **Max 12-15 scripts** (more = cascading errors)
- **1-2 screens** (more = incomplete UI)
- **3-5 entity types** (more = untested interactions)
- **1 core system** (more = integration nightmares)

#### Session Scoping Rules

**Session 1: Core Loop (MANDATORY FIRST)**
- The ONE screen where gameplay happens
- Player entity + primary action
- 1-2 challenge entities (enemies, obstacles, puzzle elements)
- Basic win/lose condition
- Minimal HUD (score or status only)
- **Max 8 scripts, zero optional features**

**Session 2: Depth**
- Second screen (menu OR results — not both)
- 1-2 more entity types
- Basic progression (difficulty increase, scoring)
- **Max 5 new scripts**

**Session 3: Flow**
- Remaining screens (menu, game over, pause)
- Screen transitions
- Full game flow: menu → play → end → retry
- **Max 5 new scripts**

**Session 4: Polish**
- Visual effects (particles, shaders, screen shake)
- Audio (procedural or loaded)
- UI styling (no default Godot theme)
- Game feel tuning
- **Modifies existing scripts, few new ones**

**Session 5+: Features**
- Shop, progression systems, daily rewards
- Additional game modes
- Social features, leaderboards
- Each session adds ONE system
- **Max 5 new scripts per session**

### Step 4: Map Assets

For each session, identify which assets are needed:

1. **Scan the docs folder for existing assets**: `*.png, *.jpg, *.svg`
2. **Map each asset to a game entity**: `bank.png → bank building, player.png → player character`
3. **List which assets Session 1 needs** (only those entities in scope)
4. **Flag assets without entities**: "Found hacker.png but hacker character is not in Session 1"
5. **Flag entities without assets**: "Enemy guard is in Session 1 but no guard sprite found — will use procedural"

### Step 5: Write SESSION_PLAN.md

Output the plan to `docs/SESSION_PLAN.md` in the project directory.

```markdown
# Session Plan: [Game Name]

## Source Documents
- [filename]: [brief description of contents]
- [filename]: [brief description of contents]

## Core Gameplay Loop
[One paragraph describing what the player does and why it's fun]

## Session 1: [Title] (THIS SESSION)

### Features to Build
1. [Feature]: [brief spec — mechanics, numbers, behavior]
2. [Feature]: [brief spec]
3. [Feature]: [brief spec]

### NOT Building This Session
- [Feature from docs]: deferred to Session [N]
- [Feature from docs]: deferred to Session [N]
- [Feature from docs]: deferred to Session [N]
(List EVERY feature from the docs that is being cut)

### File Manifest
| File | Purpose | Lines (est.) |
|------|---------|-------------|
| scripts/main.gd | Main scene controller, spawn system | ~120 |
| scripts/player.gd | Player movement and interaction | ~80 |
| ... | ... | ... |
**Total: [N] scripts (max 12)**

### Assets
| Asset | Source | Entity |
|-------|--------|--------|
| bank.png | User-provided (docs/assets/) | Bank building |
| player.png | User-provided (docs/assets/) | Player character |
| guard.png | Generate procedural | Guard enemy |
**Copy to**: `res://assets/sprites/`

### Technical Decisions
- **Scene structure**: [how the main scene is organized]
- **Collision layers**: [which layers for what]
- **Autoloads**: [singleton managers needed]
- **Input**: [input actions needed]

### Success Criteria
When Session 1 is complete, the player can:
1. [Concrete testable action]
2. [Concrete testable action]
3. [Concrete testable action]

---

## Session 2: [Title] (NEXT)
### Features
- [Feature 1]
- [Feature 2]
### New Files: ~[N] scripts

## Session 3: [Title]
### Features
- [Feature 1]
- [Feature 2]
### New Files: ~[N] scripts

## Session 4: Polish
### Focus
- Visual effects, audio, UI styling, game feel

## Session 5+: [Optional Features]
- [Feature]: [which session]
- [Feature]: [which session]
```

### Step 6: Present to User

After writing SESSION_PLAN.md, present a summary:

```
Distilled [N] documents into a [M]-session build plan.

**Session 1** (this session): [title]
- [N] scripts, [M] assets
- Core: [one-line description of what the player can do]

**Deferred**: [list of cut features]

Review docs/SESSION_PLAN.md. When ready, I'll start building Session 1.
```

**Wait for user approval before the builder starts.**

## Integration with Builder/Director

When the builder detects complex docs and invokes the distiller:

1. Distiller runs Steps 1-6, writes `SESSION_PLAN.md`
2. User approves the plan
3. Builder routes to Director with `SESSION_PLAN.md` as the source (not the raw docs)
4. Director reads `SESSION_PLAN.md` instead of the full design docs
5. Director generates PRD from the session plan (scoped, not the full game)
6. Director executes Phases 1-6 for Session 1 only

For subsequent sessions:
1. User starts a new Claude session
2. Builder checks `godot_get_build_state()` — finds Session 1 complete
3. Builder reads `SESSION_PLAN.md` — identifies Session 2 scope
4. Director picks up from Session 2, adding to existing codebase
5. Repeat until all sessions complete

## Scoping Heuristics

### Feature Classification

| Category | Session | Priority |
|----------|---------|----------|
| Core mechanic (what player does) | 1 | MUST |
| Primary challenge (what opposes player) | 1 | MUST |
| Win/lose condition | 1 | MUST |
| Basic HUD (score/status) | 1 | MUST |
| Additional entity types | 2 | HIGH |
| Menu screen | 2-3 | HIGH |
| Game over / results screen | 2-3 | HIGH |
| Difficulty progression | 2 | HIGH |
| Pause menu | 3 | MEDIUM |
| Screen transitions | 3 | MEDIUM |
| Visual polish (shaders, particles) | 4 | MEDIUM |
| Audio (SFX, music) | 4 | MEDIUM |
| Shop / store | 5+ | LOW |
| Daily rewards | 5+ | LOW |
| Leaderboards | 5+ | LOW |
| Social features | 5+ | LOW |
| Multiplayer / PvP | 5+ | LOW |
| Guilds / clans | 5+ | LOW |
| Achievements | 5+ | LOW |
| Analytics / telemetry | 5+ | LOW |
| IAP / monetization | 5+ | LOW |

### Red Flags (scope is too big for one session)

- More than 3 distinct screens described → multi-session
- More than 5 entity types → multi-session
- Any mention of: PvP, multiplayer, guilds, social → defer to Session 5+
- Any mention of: shop, IAP, daily rewards → defer to Session 5+
- Any mention of: progression systems, skill trees, crafting → defer to Session 3+
- File manifest exceeds 12 scripts → split into sessions
- Design doc is more than 5 pages → likely needs distillation

### When NOT to Distill

- User provides a short prompt (1-3 sentences) → builder handles directly
- User explicitly says "simple" or "basic" → no distillation needed
- Game concept has one screen and one mechanic → no distillation needed
- User provides a pre-scoped session plan → skip distillation

## Example: Heist Planner Distillation

**Input**: 4 design docs describing city map, puzzle mechanic, results screen, shop, daily rewards, PvP raids, guilds, 18 art assets.

**Session 1: City Map + Building Tap**
- City map screen with tappable buildings
- 5-6 building types using provided PNG assets
- Building info panel on tap
- Basic player stats (cash, level)
- 8 scripts, 8 assets from docs folder

**Session 2: Puzzle Mechanic**
- Laser grid puzzle scene
- Tile rotation mechanic
- Timer and scoring
- Transition from building tap → puzzle
- 5 new scripts

**Session 3: Results + Flow**
- Results screen with loot display
- Main menu
- Full flow: menu → city → tap → puzzle → results → city
- 5 new scripts

**Session 4: Polish**
- Cyberpunk visual effects
- Audio
- UI styling
- Animations and transitions

**Session 5+: Meta Features**
- Shop (Session 5)
- Daily rewards (Session 6)
- PvP raids (Session 7)
