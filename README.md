# AI Game Builder

A Claude Code plugin that generates playable Godot 4 games from natural language prompts.

## How It Works

```
You (natural language prompts)
    |
Claude Code + AI Game Builder plugin
    |                         |
Writes .gd/.tscn          MCP Server (godot-bridge)
directly to disk               |
    |                    Godot Editor Plugin (HTTP on port 6100)
    |                         |
Godot auto-reloads      Run / Stop / Get Errors
```

Claude Code is the brain. The plugin gives it 14 specialized game development skills, 20 MCP tools for deep editor integration, and a Stop hook that keeps it focused until the build is complete.

## Install

### Step 1: Install the Claude Code plugin

```bash
# Option A — Load directly (for development/testing)
claude --plugin-dir /path/to/godot-ai-builder

# Option B — Install from marketplace
/plugin marketplace add https://github.com/HubDev-AI/godot-ai-builder
/plugin install godot-ai-builder
```

### Step 2: Set up the Godot editor plugin

```bash
cd /path/to/godot-ai-builder
./setup.sh /path/to/your/godot/project
```

This copies the HTTP bridge plugin into your Godot project's `addons/` folder and installs MCP dependencies.

### Step 3: Enable in Godot

1. Open your project in Godot
2. Project -> Project Settings -> Plugins
3. Enable "AI Game Builder"

### Step 4: Build a game

```bash
cd /path/to/your/godot/project
claude --plugin-dir /path/to/godot-ai-builder
```

Then tell Claude what you want:
```
Make a shooter game
```

Claude will ask whether you want a **full game** (6-phase build with PRD, enemies, UI, polish) or a **simple game** (minimal, fast, playable). Give a detailed prompt to skip the question and go straight to building.

For full games, Claude also asks about your preferred **visual tier**: procedural (shaders, gradients, glow effects — default), custom art (you provide sprites), AI-generated art (generates prompts for DALL-E/Midjourney), or prototype (basic shapes).

## Plugin Contents

### 14 Skills

| Skill | Purpose |
|-------|---------|
| `godot-builder` | Master router — entry point for all requests |
| `godot-director` | Game Director — 6-phase build protocol with quality gates |
| `godot-polish` | Game juice — screen shake, particles, hit flash, animations |
| `godot-init` | Project bootstrapping, folder structure, project.godot |
| `godot-gdscript` | GDScript syntax, patterns, common mistakes |
| `godot-scene-arch` | Scene building (programmatic vs .tscn) |
| `godot-player` | Player controllers for every genre |
| `godot-enemies` | Enemy AI, spawn systems, boss patterns |
| `godot-physics` | Collision layers, physics bodies, Area2D triggers |
| `godot-ui` | UI screens, HUD, menus, transitions |
| `godot-effects` | Audio, particles, tweens, visual effects |
| `godot-assets` | Visual quality system: procedural visuals, shaders, art pipelines |
| `godot-ops` | MCP tool operations: run, stop, errors, reload |
| `godot-templates` | Genre-specific templates with file manifests |

### MCP Tools (21 tools via godot-bridge)

| Tool | Purpose |
|------|---------|
| `godot_get_project_state` | Read project structure and settings |
| `godot_run_scene` | Run the game in the editor |
| `godot_stop_scene` | Stop the running game |
| `godot_get_errors` | Read editor error log |
| `godot_reload_filesystem` | Tell Godot to rescan files |
| `godot_generate_asset` | Generate polished SVG/PNG sprites for entities |
| `godot_generate_asset_pack` | Generate a full coherent asset set for a game genre |
| `godot_parse_scene` | Parse .tscn file structure |
| `godot_scan_project_files` | List all project files |
| `godot_read_project_setting` | Read project.godot values |
| `godot_log` | Send progress messages to the Godot dock panel |
| `godot_save_build_state` | Save build checkpoint (phase progress, files, quality gates) |
| `godot_get_build_state` | Load build checkpoint (detect interrupted builds) |
| `godot_evaluate_quality_gates` | Run objective quality checks (especially Phase 5/6) and return failed gates |
| `godot_update_phase` | Update dock phase progress (number, name, status, gates) |

**Editor Integration** (inspect, verify, manipulate — what Ziva charges $20/month for):

| Tool | Purpose |
|------|---------|
| `godot_get_scene_tree` | Inspect the live scene tree — node hierarchy, types, scripts, visibility |
| `godot_get_class_info` | Look up any Godot class — properties, methods, signals via ClassDB |
| `godot_add_node` | Add a node to the current scene with type and properties |
| `godot_update_node` | Modify properties on an existing node (position, scale, etc.) |
| `godot_delete_node` | Remove a node from the current scene |
| `godot_get_editor_screenshot` | Capture 2D/3D viewport as base64 PNG — Claude can "see" the game |
| `godot_get_open_scripts` | List scripts open in the script editor for context |

### Hooks

- **Stop hook** — Prevents Claude from quitting mid-game-build. Automatically engaged when the Director starts a build and released when all 6 phases complete.

## The Director Protocol

When you ask for a complete game, the Director runs a 6-phase build:

1. **Phase 0: PRD** — Writes a detailed game design document for your approval
2. **Phase 1: Foundation** — Player movement, camera, background
3. **Phase 2: Abilities** — Shooting, jumping, interactions
4. **Phase 3: Enemies** — AI, spawning, combat, scoring
5. **Phase 4: UI** — Menu, HUD, game over, pause, transitions
6. **Phase 5: Polish** — Shader effects, particles, screen shake, multi-layer backgrounds, styled UI
7. **Phase 6: QA** — Error checking, edge cases, final verification

Each phase has quality gates. Claude won't proceed until they pass.
For Phase 5/6, `godot_update_phase(..., "completed")` also runs objective quality checks and rejects completion when required gates fail.

## Build Resumption

If a Claude session is interrupted mid-build (rate limit, crash, closed terminal), the checkpoint system preserves your progress. When you restart Claude:

1. Claude detects the saved build state (`.claude/build_state.json`)
2. Shows you a summary: game name, last completed phase, files written
3. Asks: "Continue this build?" or "Start fresh?"
4. If you continue, it validates existing files and resumes from where it left off

No more re-explaining your game after a session crash.

## Example Prompts

### From a prompt
```
"Create a 2D platformer with wall-jumping, coins, and 3 levels"
"Make a tower defense game with 3 tower types and wave progression"
```

### From a design folder
```
"Build the game from the docs in ~/my-game-design/"
"Take this folder ~/rpg-project/ and start working on this game"
```

### Feature additions
```
"Add a boss enemy that shoots in patterns"
"Make the game look more polished — add particles and screen shake"
"Fix the errors and run the game"
```

## Requirements

- **Godot 4.3+** (editor must be open during generation)
- **Node.js 20+** (for the MCP server)
- **Claude Code 1.0.33+** (plugin support required)

## Smoke Test

Use this to verify the Godot HTTP bridge is alive before a build session:

```bash
node scripts/smoke-test.mjs
```

Optional deeper checks:

```bash
node scripts/smoke-test.mjs --full
```

You can also override host/port if needed:

```bash
node scripts/smoke-test.mjs --host 127.0.0.1 --port 6100 --timeout 7000
```

## Project Structure

```
godot-ai-builder/
├── .claude-plugin/            # Plugin manifest
│   ├── plugin.json
│   └── marketplace.json
├── skills/                    # 14 game generation skills
│   ├── godot-builder/         # Master router
│   ├── godot-director/        # Game Director (6-phase protocol)
│   ├── godot-polish/          # Game feel & juice
│   └── ...                    # 11 more specialized skills
├── hooks/                     # Stop hook (build guard)
│   ├── hooks.json
│   └── stop-guard.sh
├── .mcp.json                  # MCP server configuration
├── mcp-server/                # Node.js MCP bridge
│   ├── index.js
│   └── src/
│       ├── tools.js           # 21 MCP tool definitions
│       ├── godot-bridge.js    # HTTP client -> Godot
│       ├── scene-parser.js    # .tscn parser
│       └── asset-generator.js # SVG/PNG generator
├── godot-plugin/              # Godot editor plugin
│   └── addons/ai_game_builder/
│       ├── plugin.gd
│       ├── http_bridge.gd     # HTTP server (port 6100)
│       ├── dock.gd            # Status panel (progress, controls, error badges, quality gates)
│       ├── error_collector.gd
│       └── project_scanner.gd
├── knowledge/                 # Reference docs
├── setup.sh                   # Godot editor plugin installer
├── GETTING-STARTED.md         # Full walkthrough guide
└── README.md
```

## License

MIT
