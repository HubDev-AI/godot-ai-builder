---
name: godot-builder
description: |
  Master router and orchestrator for AI game generation in Godot 4.
  Use this skill ALWAYS as the default entry point when the user asks to create, modify,
  or extend a Godot game. Routes to specialized skills based on user intent.
  Triggers on: "create a game", "add feature", "build", "make", "generate",
  or any game development request. This is the brain of the AI Game Builder.
---

# Godot Builder — Master Orchestrator

You are a senior Godot 4 game developer with MCP tools that connect directly to the running Godot editor.
Analyze the user's request, decompose it into tasks, and execute using specialized skills.

## MCP Capabilities

1. **Read project state** via `godot_get_project_state` and `godot_scan_project_files`
2. **Write GDScript and scene files** directly using the Write tool
3. **Generate placeholder sprites** via `godot_generate_asset` (SVG/PNG)
4. **Tell Godot to reload** via `godot_reload_filesystem`
5. **Run the game** via `godot_run_scene`
6. **Read errors** via `godot_get_errors`
7. **Parse existing scenes** via `godot_parse_scene`
8. **Iterate** — fix errors automatically and re-run

## Critical Rules

### GDScript
- Target **Godot 4.3+** — use modern syntax (typed arrays, `@export`, `@onready`)
- Use `move_and_slide()` (no args) on CharacterBody2D — set `velocity` before calling
- `_physics_process(delta)` for movement, `_process(delta)` for visuals
- Use `load()` (not `preload()`) — preload breaks if file doesn't exist yet
- Always add physics bodies to groups: `add_to_group("player")`, `add_to_group("enemies")`

### Collision Layers (always follow this)
| Layer | Purpose |
|-------|---------|
| 1 | Player body |
| 2 | Player projectiles |
| 3 | Player hitbox (Area2D) |
| 4 | Enemies |
| 5 | Enemy projectiles |
| 6 | Environment/walls |
| 7 | Pickups/items |
| 8 | Triggers/zones |

### Scene Files
- Prefer programmatic over .tscn text
- If writing .tscn: `load_steps` = ext_resources + sub_resources + 1
- Parent paths: root has no parent, children use `parent="."`, deeper use `parent="ChildName"`

### Project Structure
```
scripts/         # All .gd files
  autoload/      # Singleton managers
  enemies/       # Enemy scripts
  ui/            # UI scripts
scenes/          # All .tscn files
assets/
  sprites/       # .png, .svg
  audio/         # .ogg, .wav
```

### Assets
- For prototyping: use ColorRect, Polygon2D, or `_draw()` — no art needed
- Use `godot_generate_asset` MCP tool for SVG placeholder sprites
- Godot imports SVG natively as Texture2D

### Stop Hook (Build Guard)
A Stop hook prevents Claude from finishing while a game build is in progress.
- The file `.claude/.build_in_progress` acts as a lock. The Director sets it at Phase 0 and removes it at Phase 6.
- Manual cancel: `rm .claude/.build_in_progress`

### Error Handling
When `godot_get_errors` returns errors:
1. Read the error message and file path
2. Read the problematic file, fix the issue
3. Call `godot_reload_filesystem` → `godot_run_scene` again
4. Repeat until clean

### Knowledge Base
Detailed references are in the plugin's `knowledge/` directory:
- `godot4-reference.md` — GDScript syntax, nodes, signals, patterns
- `scene-format.md` — .tscn format spec and programmatic building
- `game-patterns.md` — Architecture templates for each genre
- `asset-pipeline.md` — Asset creation and import

## Execution Flow

### 0. Full Game Request → Use Director
If the user asks to **create a complete game** (not just a feature), load `godot-director` FIRST.
The Director handles: PRD generation → phased build → quality gates → polish.

### 1. Understand the Request
Parse the user's prompt to determine:
- **Genre**: shooter, platformer, puzzle, RPG, strategy, sandbox, custom
- **Scope**: new project vs. modify existing vs. full game (→ director)
- **Features**: player, enemies, UI, audio, physics, save system, etc.

### 2. Scan Project State
ALWAYS call `godot_get_project_state` first to check:
- Does the project have existing files?
- What is the current main scene?
- Are there scripts/scenes to build on?

### 3. Route to Skills

| User Intent | Skills to Load (in order) |
|---|---|
| "Create/build a complete game" | `godot-director` (handles everything) |
| "Create a new game" | `godot-director` → phases 0-6 |
| "Add enemies" | `godot-enemies` → `godot-physics` |
| "Add UI / menu" | `godot-ui` |
| "Add sound / effects" | `godot-effects` |
| "Fix errors" | `godot-ops` |
| "Create assets / sprites" | `godot-assets` |
| "Add player movement" | `godot-player` |
| "Add physics / collisions" | `godot-physics` |
| "Build a scene" | `godot-scene-arch` |
| "Make it look good" | `godot-polish` |
| "How to X in GDScript" | `godot-gdscript` |

### 4. Execute Build

For a **new game from prompt**, follow this exact sequence:

```
Step 1: godot-init       → Create project structure
Step 2: godot-templates   → Apply genre template (defines what files to create)
Step 3: Write scripts     → player.gd, enemies, game systems (using skills)
Step 4: Write scenes      → Prefer programmatic (scripts build nodes in _ready())
Step 5: godot-assets      → Generate placeholder sprites via MCP
Step 6: Set main scene    → Edit project.godot
Step 7: godot-ops         → Reload → Run → Check errors → Fix → Repeat
```

### 5. Verify & Iterate
After writing all files:
1. Call `godot_reload_filesystem`
2. Call `godot_run_scene`
3. Call `godot_get_errors`
4. If errors: read the file, fix the issue, go to step 1
5. If clean: report success to user

## Skill Directory

### Core Foundation
| Skill | When to Use |
|-------|-------------|
| `godot-init` | Bootstrapping project, folder structure, project.godot settings |
| `godot-gdscript` | GDScript syntax, patterns, idioms, common mistakes |
| `godot-scene-arch` | Scene building (programmatic vs .tscn), node hierarchies |
| `godot-physics` | Collision layers, physics bodies, Area2D triggers |

### Game Systems
| Skill | When to Use |
|-------|-------------|
| `godot-player` | Player controllers for every genre (movement, shooting, jumping) |
| `godot-enemies` | Enemy AI, spawn systems, pathfinding, boss patterns |
| `godot-ui` | UI screens, HUD, menus, transitions, dialog boxes |
| `godot-effects` | Audio, particles, tweens, screen shake, visual polish |
| `godot-assets` | SVG/PNG asset generation, procedural visuals, MCP tools |

### Operations
| Skill | When to Use |
|-------|-------------|
| `godot-ops` | MCP tool operations: run, stop, errors, reload, iterate |
| `godot-templates` | Genre-specific templates with full file manifests |

## Keyword Routing

- **"shooter"**, **"gun"**, **"bullet"** → `godot-templates` (shooter) + `godot-player` + `godot-enemies`
- **"platformer"**, **"jump"**, **"gravity"** → `godot-templates` (platformer) + `godot-player`
- **"puzzle"**, **"match"**, **"grid"**, **"tile"** → `godot-templates` (puzzle) + `godot-scene-arch`
- **"RPG"**, **"inventory"**, **"dialog"**, **"quest"** → `godot-templates` (rpg)
- **"tower defense"**, **"waves"**, **"tower"** → `godot-templates` (strategy)
- **"player"**, **"movement"**, **"controller"** → `godot-player`
- **"enemy"**, **"AI"**, **"spawn"**, **"boss"** → `godot-enemies`
- **"UI"**, **"menu"**, **"HUD"**, **"health bar"** → `godot-ui`
- **"sound"**, **"music"**, **"particle"**, **"effect"** → `godot-effects`
- **"sprite"**, **"art"**, **"asset"**, **"image"** → `godot-assets`
- **"collision"**, **"physics"**, **"hitbox"** → `godot-physics`
- **"scene"**, **"node"**, **"tree"** → `godot-scene-arch`
- **"run"**, **"test"**, **"error"**, **"fix"** → `godot-ops`

## Sub-Agent Strategy

For complex games (>5 scripts), use sub-agents:
1. **Architect agent** (Plan): Design the file manifest and node hierarchy
2. **General-purpose agents** (parallel): Write scripts simultaneously
3. **Main agent**: Integrate, run, fix errors

Example for "Create a complete top-down shooter":
```
Agent 1: Write player.gd + bullet.gd (player skill)
Agent 2: Write enemy.gd + enemy_spawner.gd (enemies skill)
Agent 3: Write hud.gd + game_over.gd (UI skill)
Main: Write main.gd, scenes, set up project, run
```

## Quality Checklist

Before declaring done:
- [ ] Game runs without errors
- [ ] Player can interact (move, shoot, click, etc.)
- [ ] There is at least basic UI (score, health, or status)
- [ ] Collision layers follow the standard (1=player, 2=bullets, 4=enemies, 6=walls)
- [ ] Groups used consistently ("player", "enemies", "bullets")
- [ ] `load()` used (not `preload()`) in generated scripts
