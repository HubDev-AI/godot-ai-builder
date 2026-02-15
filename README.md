# AI Game Builder

Generate playable Godot 4 game prototypes from natural language prompts using Claude Code.

## How It Works

```
You (natural language prompts)
    ↓
Claude Code (writes game code + calls MCP tools)
    ↓                         ↓
Writes .gd/.tscn          MCP Server (Node.js)
directly to disk               ↓
    ↓                    Godot Plugin (HTTP bridge)
    ↓                         ↓
Godot auto-reloads      Run / Stop / Get Errors
```

Claude Code is the brain. It writes GDScript and scene files directly, generates placeholder assets, runs the game through the Godot editor, reads errors, and fixes them — all autonomously.

## Requirements

- **Godot 4.3+** (editor must be open during generation)
- **Node.js 20+** (for the MCP server)
- **Claude Code** (Anthropic's CLI)

## Quick Start

```bash
# 1. Clone this repo
git clone <repo-url> godot-ai-builder
cd godot-ai-builder

# 2. Run setup pointing to your Godot project
chmod +x setup.sh
./setup.sh /path/to/your/godot/project

# 3. Open Godot → Project Settings → Plugins → Enable "AI Game Builder"

# 4. Open Claude Code in your project
cd /path/to/your/godot/project
claude

# 5. Start building
# "Create a 2D top-down shooter with enemies, health, and score"
```

## Manual Setup

If you prefer manual installation:

### 1. Install MCP server
```bash
cd mcp-server
npm install
```

### 2. Copy plugin to your Godot project
```bash
cp -r godot-plugin/addons/ai_game_builder /path/to/project/addons/
```

### 3. Copy knowledge base
```bash
cp -r knowledge/ /path/to/project/knowledge/
cp .claude/CLAUDE.md /path/to/project/.claude/CLAUDE.md
```

### 4. Configure Claude Code MCP

Add to your project's `.claude/settings.json`:
```json
{
  "mcpServers": {
    "godot-ai-builder": {
      "command": "node",
      "args": ["/full/path/to/godot-ai-builder/mcp-server/index.js"],
      "env": {
        "GODOT_PROJECT_PATH": "/full/path/to/your/godot/project",
        "GODOT_BRIDGE_PORT": "6100"
      }
    }
  }
}
```

### 5. Enable the plugin in Godot
Project → Project Settings → Plugins → Enable "AI Game Builder"

## What Claude Code Can Do

| Capability | How |
|---|---|
| Read project structure | `godot_get_project_state` MCP tool |
| Write scripts & scenes | Claude Code's built-in Write tool |
| Generate placeholder sprites | `godot_generate_asset` MCP tool (SVG/PNG) |
| Reload editor filesystem | `godot_reload_filesystem` MCP tool |
| Run the game | `godot_run_scene` MCP tool |
| Read editor errors | `godot_get_errors` MCP tool |
| Parse scene files | `godot_parse_scene` MCP tool |
| Fix errors and re-run | Autonomous iteration loop |

## Example Prompts

```
"Create a 2D platformer with wall-jumping, coins, and 3 levels"

"Add a boss enemy that shoots in patterns"

"Create an inventory system with drag-and-drop"

"Make a tower defense game with 3 tower types and wave progression"

"Add particle effects when enemies die"

"Create a main menu with Start, Settings, and Quit buttons"

"Add save/load functionality using JSON"
```

## Architecture

```
godot-ai-builder/
├── .claude/CLAUDE.md           # Makes Claude Code a Godot expert
├── mcp-server/                 # MCP server (bridges Claude ↔ Godot)
│   ├── index.js                # Server entry point
│   └── src/
│       ├── tools.js            # Tool definitions + handlers
│       ├── godot-bridge.js     # HTTP client → Godot plugin
│       ├── scene-parser.js     # .tscn file parser
│       └── asset-generator.js  # SVG/PNG placeholder generator
├── godot-plugin/               # Godot editor plugin
│   └── addons/ai_game_builder/
│       ├── plugin.gd           # Plugin lifecycle
│       ├── dock.gd             # Status panel
│       ├── http_bridge.gd      # HTTP server (port 6100)
│       ├── error_collector.gd  # Error aggregation
│       └── project_scanner.gd  # Project file scanner
├── knowledge/                  # Reference docs for Claude Code
│   ├── godot4-reference.md     # GDScript + nodes
│   ├── scene-format.md         # .tscn specification
│   ├── game-patterns.md        # Genre templates
│   └── asset-pipeline.md       # Asset creation guide
├── setup.sh                    # One-command installer
└── README.md
```

## The Godot Plugin

The plugin runs an HTTP server on port 6100 inside the Godot editor. The dock panel shows:
- Bridge connection status
- Activity log (file writes, scene runs, errors)

The plugin is passive — Claude Code drives all actions through MCP tools.

## Troubleshooting

**"Godot editor not responding"**
- Make sure the Godot editor is open
- Check that the AI Game Builder plugin is enabled
- The HTTP bridge runs on port 6100 — check for port conflicts

**"Cannot connect to MCP server"**
- Run `node mcp-server/index.js` manually to check for errors
- Verify `GODOT_PROJECT_PATH` in your Claude settings points to the right directory

**Scene files cause parse errors**
- Prefer programmatic scene building (scripts that build nodes in `_ready()`)
- Check `load_steps` count matches actual resources in .tscn files

## License

MIT
