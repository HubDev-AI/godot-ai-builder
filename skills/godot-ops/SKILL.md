---
name: godot-ops
description: |
  MCP tool operations: run game, read errors, reload filesystem, iterate fixes.
  Use when testing, debugging, or running the build-test-fix loop.
  This is the "DevOps" skill for AI game generation.
  CRITICAL: Always use MCP tools, never raw curl. Always report progress.
---

# Operations — Build, Run, Fix Loop

## RULE: Always Use MCP Tools

Use `godot_reload_filesystem`, `godot_run_scene`, `godot_get_errors`, etc.
**NEVER use raw `curl http://localhost:6100/...`** — that bypasses MCP and means the plugin isn't loaded.

If MCP tools aren't available, stop and tell the user:
> "MCP tools not available. Start Claude Code with: `claude --plugin-dir /path/to/godot-ai-builder`"

## RULE: Always Report Progress (Terminal + Godot Dock)

After EVERY action, report in TWO places:
1. **Terminal**: Print text for the user
2. **Godot dock**: Call `godot_log` so the Godot editor panel shows activity

```
godot_log("Reloading Godot filesystem...")
godot_log("Running game... checking for errors...")
godot_log("Found 2 errors. Fixing scripts/player.gd line 34...")
godot_log("Game running. 0 errors. Phase 1 complete.")
```

NEVER write files silently. Call `godot_log` BEFORE and AFTER every action. The more calls the better — the user wants to see constant activity in the Godot dock panel.

## The Core Loop

After writing ANY game files, ALWAYS execute this loop immediately:

```
1. godot_reload_filesystem    → Editor sees new files
2. godot_run_scene            → Launch the game
3. (wait a moment)
4. godot_get_errors           → Check for problems
5. If errors: fix → go to 1
6. If clean: done!
```

## MCP Tool Reference

### godot_get_project_state
Call FIRST before any work. Returns:
- `editor_connected` (bool) — is Godot running with plugin?
- `project_name`, `main_scene`
- `files.scripts[]`, `files.scenes[]`, `files.assets[]`

### godot_reload_filesystem
Call after writing ANY file. The editor won't see changes until you do this.

### godot_run_scene
Run the game. Optional `scene_path` argument for a specific scene.
```json
{"scene_path": "res://scenes/main.tscn"}
```
Or omit for main scene:
```json
{}
```

### godot_stop_scene
Stop a running game. Call before running again.

### godot_get_errors
Returns:
```json
{
  "errors": [{"message": "...", "file": "res://...", "line": 42}],
  "warnings": [{"message": "...", "file": "res://...", "line": 10}]
}
```

### godot_parse_scene
Parse a .tscn file to understand its structure:
```json
{"scene_path": "res://scenes/main.tscn"}
```

### godot_generate_asset
Generate placeholder sprites:
```json
{"name": "player", "type": "character", "width": 32, "height": 32, "color": "#3399ff"}
```

### godot_scan_project_files
List all project files (works without editor running).

### godot_read_project_setting
Read from project.godot:
```json
{"key": "application/run/main_scene"}
```

### godot_log
Send a message to the Godot dock panel. Call this CONSTANTLY for user visibility:
```json
{"message": "Writing scripts/player.gd — WASD movement..."}
```
Call BEFORE and AFTER every file write, every test, every error fix. Sub-agents should prefix with their name: `"[Agent: enemies] Writing enemy.gd..."`

## Error Resolution Patterns

### "Cannot preload resource"
**Cause**: Script uses `preload()` for a file that doesn't exist yet.
**Fix**: Replace `preload()` with `load()` in the script.

### "Invalid call to function 'X' in base 'Y'"
**Cause**: Calling a method that doesn't exist on that node type.
**Fix**: Check the node type. Common mistake: calling physics methods on wrong body type.

### "Identifier 'X' not declared in current scope"
**Cause**: Using a variable/function that doesn't exist.
**Fix**: Check spelling, check if it's defined in the right scope, check imports.

### Scene parse errors
**Cause**: Malformed .tscn file.
**Fix**: Check `load_steps` count, parent paths, quote formatting.
**Better**: Rewrite as programmatic scene (script builds nodes in `_ready()`).

### "Node not found: 'X'"
**Cause**: `$NodeName` references a node that doesn't exist in the tree.
**Fix**: Either the node isn't created yet (use `@onready` or build in `_ready()`), or it has a different name.

### Collision not working
**Cause**: Layer/mask mismatch.
**Fix**: Use `set_collision_layer_value()` and `set_collision_mask_value()` to be explicit. Check:
- Bullets (Area2D): layer must be set, mask must include enemy layer
- Area2D.body_entered: only fires for CharacterBody2D/RigidBody2D/StaticBody2D
- Area2D.area_entered: only fires for other Area2Ds

## Setting Main Scene

After generating a game, always set the main scene:

**Via project.godot** (edit the file directly):
```ini
[application]
run/main_scene="res://scenes/main.tscn"
```

**Via MCP**: The `godot_reload_filesystem` will pick up the change.

## Preflight Checklist

Before running:
- [ ] All scripts have correct `extends` (CharacterBody2D, Area2D, Node2D, etc.)
- [ ] All `load()` paths point to files that exist
- [ ] Collision layers/masks are set
- [ ] Groups are assigned (`"player"`, `"enemies"`, etc.)
- [ ] Main scene is set in project.godot
- [ ] `godot_reload_filesystem` was called

## When Godot Editor Is Not Connected

If `godot_get_project_state` shows `editor_connected: false`:
1. File operations still work (Write tool writes directly)
2. `godot_scan_project_files` still works (reads filesystem)
3. `godot_parse_scene` still works (reads .tscn files)
4. `godot_generate_asset` still works (creates SVG/PNG files)
5. BUT: `godot_run_scene`, `godot_stop_scene`, `godot_get_errors`, `godot_reload_filesystem` will fail

Tell the user: "Please open the Godot editor and enable the AI Game Builder plugin, then try again."
