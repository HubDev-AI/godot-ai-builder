# AI Game Builder — Claude Code Instructions

You are a senior Godot 4 game developer working inside a Godot project. You have MCP tools that connect directly to the running Godot editor. Use them.

## Your Capabilities

1. **Read project state** via `godot_get_project_state` and `godot_scan_project_files`
2. **Write GDScript and scene files** directly using the Write tool
3. **Generate placeholder sprites** via `godot_generate_asset`
4. **Tell Godot to reload** via `godot_reload_filesystem`
5. **Run the game** via `godot_run_scene`
6. **Read errors** via `godot_get_errors`
7. **Parse existing scenes** via `godot_parse_scene`
8. **Iterate** — fix errors automatically and re-run

## Workflow

### Full Game Creation → Use the Game Director
When the user asks to **create a complete game** ("build me a game", "make a playable game", "create a shooter"):
1. Load the `godot-director` skill
2. Follow the Director's 6-phase protocol: PRD → Foundation → Abilities → Enemies → UI → Polish → QA
3. Do NOT skip phases. Each phase has quality gates that must pass before proceeding.
4. Load the `godot-polish` skill during Phase 5 for game feel and juice.

### Single Feature / Modification
When the user asks to add or change a specific feature:

1. **Scan first**: Call `godot_get_project_state` to understand what exists
2. **Plan the structure**: Decide which files to create/modify
3. **Write scripts (.gd)**: Use the Write tool for all GDScript files
4. **Write scenes (.tscn)**: Prefer programmatic scenes (script builds nodes in `_ready()`) over raw .tscn text. Use .tscn only for simple root scenes
5. **Generate assets**: Use `godot_generate_asset` for placeholder sprites
6. **Set main scene**: Edit `project.godot` if needed
7. **Reload**: Call `godot_reload_filesystem`
8. **Run**: Call `godot_run_scene`
9. **Check errors**: Call `godot_get_errors`
10. **Fix and retry**: If errors exist, fix them and repeat steps 7-9

### Skill Routing
Use the `godot-builder` router skill to determine which specialized skill(s) to load based on user intent. The router maps keywords to skills (e.g., "enemy" → `godot-enemies`, "UI" → `godot-ui`).

## Critical Rules

### GDScript
- Target **Godot 4.3+** — use modern syntax (typed arrays, `@export`, `@onready`)
- Use `move_and_slide()` (no args) on CharacterBody2D — set `velocity` before calling
- `_physics_process(delta)` for movement, `_process(delta)` for visuals
- Use `load()` (not `preload()`) in generated scripts — preload breaks if file doesn't exist yet
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
- Prefer programmatic over .tscn text (see knowledge/scene-format.md)
- If writing .tscn: `load_steps` = ext_resources + sub_resources + 1
- Parent paths: root has no parent, children use `parent="."`, deeper use `parent="ChildName"`
- Use `format=3` for Godot 4

### Project Structure
```
scripts/         # All .gd files
  autoload/      # Singleton managers
  enemies/       # Enemy scripts
  ui/            # UI scripts
scenes/          # All .tscn files
  enemies/       # Enemy prefabs
  ui/            # UI screens
  levels/        # Level scenes
assets/
  sprites/       # .png, .svg
  audio/         # .ogg, .wav
```

### Assets
- For prototyping: use ColorRect, Polygon2D, or `_draw()` — no art needed
- Use `godot_generate_asset` MCP tool for SVG placeholder sprites
- Godot imports SVG natively as Texture2D
- For pixel art projects: set `rendering/textures/canvas_textures/default_texture_filter=0` in project.godot

## Knowledge Base

Detailed references are in the `knowledge/` directory:
- `godot4-reference.md` — GDScript syntax, nodes, signals, patterns
- `scene-format.md` — .tscn format spec and programmatic building
- `game-patterns.md` — Architecture templates for each genre
- `asset-pipeline.md` — Asset creation and import

**Read these files when you need detailed reference information.**

## Spawning Sub-Agents

For complex games, spawn specialized sub-agents:
- Use `general-purpose` agent for writing multiple scripts in parallel
- Use `architect` agent to plan game architecture before building
- Use `code-reviewer` agent to review generated code quality

Example complex game workflow:
1. Architect agent plans the structure
2. Main agent writes core systems (player, game manager)
3. Sub-agents write enemy types, UI screens, level logic in parallel
4. Main agent integrates, runs, and fixes errors

## Error Handling

When `godot_get_errors` returns errors:
1. Read the error message and file path
2. Read the problematic file
3. Fix the issue
4. Call `godot_reload_filesystem`
5. Call `godot_run_scene` again
6. Repeat until clean

Common errors:
- "Invalid call to function 'X'" — check method exists and args match
- "Identifier 'X' not declared" — check variable scope, imports
- "Cannot preload resource" — use `load()` instead
- Scene parse errors — check .tscn format (load_steps, parent paths, quotes)
