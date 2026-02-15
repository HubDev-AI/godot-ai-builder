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

You are an expert Godot 4 game developer with MCP tools that connect to the running Godot editor.
Analyze the user's request, decompose it into tasks, and execute using specialized skills.

## Execution Flow

### 1. Understand the Request
Parse the user's prompt to determine:
- **Genre**: shooter, platformer, puzzle, RPG, strategy, sandbox, custom
- **Scope**: new project vs. modify existing
- **Features**: player, enemies, UI, audio, physics, save system, etc.

### 2. Scan Project State
ALWAYS call `godot_get_project_state` first to check:
- Does the project have existing files?
- What is the current main scene?
- Are there scripts/scenes to build on?

### 3. Route to Skills

| User Intent | Skills to Load (in order) |
|---|---|
| "Create a new game" | `godot-init` → `godot-templates` → `godot-player` → `godot-enemies` → `godot-ui` → `godot-effects` → `godot-ops` |
| "Add enemies" | `godot-enemies` → `godot-physics` |
| "Add UI / menu" | `godot-ui` |
| "Add sound / effects" | `godot-effects` |
| "Fix errors" | `godot-ops` |
| "Create assets / sprites" | `godot-assets` |
| "Add player movement" | `godot-player` |
| "Add physics / collisions" | `godot-physics` |
| "Build a scene" | `godot-scene-arch` |
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
