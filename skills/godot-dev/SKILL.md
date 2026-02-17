---
name: godot-dev
description: |
  Internal development skill for working on the AI Game Builder plugin itself.
  NOT for game generation — this is for modifying the builder's skills, MCP server,
  Godot plugin, hooks, docs, and tooling. Load this when continuing builder development.
  Triggers on: "improve the builder", "add a new skill", "fix the MCP server",
  "update the plugin", or any request about developing the AI Game Builder itself.
---

# AI Game Builder — Developer Guide

This skill is for **developing the builder itself**, not for generating games.
Use it when modifying skills, the MCP server, the Godot editor plugin, hooks, or docs.

## Architecture Overview

```
User prompt → Claude Code + plugin (skills + MCP + hooks)
                    │                           │
              Writes .gd/.tscn             MCP Server (Node.js)
              directly to disk                  │
                    │                    HTTP on port 6100
                    │                           │
              Godot auto-reloads      Godot Editor Plugin (GDScript)
                                      (bridge + dock + errors + scanner)
```

**Three layers:**
1. **Claude Code Plugin** — Skills (SKILL.md files), hooks, `.mcp.json`, `.claude-plugin/`
2. **MCP Server** — Node.js process (`mcp-server/`) bridging Claude ↔ Godot via stdio (MCP protocol) + HTTP (to Godot)
3. **Godot Editor Plugin** — GDScript (`godot-plugin/`) running inside the Godot editor, HTTP server on port 6100

Claude Code starts the MCP server automatically via `.mcp.json`. The MCP server talks to the Godot editor plugin over HTTP. Users don't start anything manually except enabling the Godot plugin.

## File Map

```
godot-ai-builder/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest (name, version, author, keywords)
│   └── marketplace.json         # Marketplace registry entry
│
├── skills/                      # 14 game-generation skills + this dev skill
│   ├── godot-builder/SKILL.md   # Master router — entry point for all game requests
│   ├── godot-director/SKILL.md  # 6-phase build protocol (PRD → Foundation → ... → QA)
│   ├── godot-init/SKILL.md      # Project bootstrapping, folder structure
│   ├── godot-gdscript/SKILL.md  # GDScript syntax and patterns reference
│   ├── godot-scene-arch/SKILL.md # Scene building (programmatic vs .tscn)
│   ├── godot-physics/SKILL.md   # Collision layers, physics bodies
│   ├── godot-player/SKILL.md    # Player controllers (top-down, platformer, twin-stick, etc.)
│   ├── godot-enemies/SKILL.md   # Enemy AI, spawn systems, boss patterns
│   ├── godot-ui/SKILL.md        # UI screens, HUD, menus, transitions
│   ├── godot-effects/SKILL.md   # Audio, particles, tweens, visual effects
│   ├── godot-assets/SKILL.md    # Visual quality system, shaders, procedural art
│   ├── godot-polish/SKILL.md    # Game feel — screen shake, dissolve, hit flash, juice
│   ├── godot-ops/SKILL.md       # MCP tool operations (run, stop, errors, reload)
│   ├── godot-templates/SKILL.md # Genre-specific file manifests
│   └── godot-dev/SKILL.md       # THIS FILE — builder development guide
│
├── hooks/
│   ├── hooks.json               # Hook registration (Stop hook only)
│   └── stop-guard.sh            # Prevents Claude from quitting mid-build
│
├── .mcp.json                    # MCP server config (auto-launched by Claude Code)
│
├── mcp-server/
│   ├── index.js                 # MCP server entry — Server + StdioServerTransport
│   ├── package.json             # Dependencies: @modelcontextprotocol/sdk, sharp
│   └── src/
│       ├── tools.js             # TOOL_DEFINITIONS array (21 tools) + handleToolCall dispatcher + handlers
│       ├── godot-bridge.js      # HTTP client → Godot editor (port 6100)
│       ├── scene-parser.js      # .tscn text format parser
│       └── asset-generator.js   # SVG/PNG sprite generator (layered gradients, shadows, glow)
│
├── godot-plugin/
│   └── addons/ai_game_builder/
│       ├── plugin.cfg           # Godot plugin metadata
│       ├── plugin.gd            # EditorPlugin — starts bridge + dock
│       ├── http_bridge.gd       # HTTP server (port 6100) — route handlers
│       ├── dock.gd              # Bottom dock panel — status + log display
│       ├── dock.tscn            # Dock scene file
│       ├── error_collector.gd   # Two-strategy error detection (script validation + log scan)
│       └── project_scanner.gd   # File discovery for /state endpoint
│
├── knowledge/                   # Reference docs (copied into user projects by setup.sh)
│   ├── godot4-reference.md      # GDScript syntax, nodes, signals
│   ├── scene-format.md          # .tscn format spec
│   ├── game-patterns.md         # Architecture templates per genre
│   └── asset-pipeline.md        # Asset creation and import
│
├── setup.sh                     # Installs Godot plugin + knowledge into a project
├── README.md                    # Public README
├── GETTING-STARTED.md           # Full user walkthrough (6 steps)
└── GETTING-STARTED.pdf          # PDF version (generated via pandoc + typst)
```

## Key Conventions

### Skill Format
Each skill is a directory under `skills/` containing a single `SKILL.md` file.
The file has YAML frontmatter (`name`, `description`) and markdown body.
Skills are namespaced as `/godot-ai-builder:godot-*` when the plugin is loaded.

```markdown
---
name: godot-skillname
description: |
  One-paragraph description of what this skill does.
  Include trigger phrases so Claude knows when to load it.
---

# Skill Title

Content: patterns, code examples, checklists, rules.
```

**Skill content IS the instruction set.** There's no separate config — the markdown
text directly controls what Claude does when it loads the skill. Write it as if
you're briefing a senior developer on exactly how to do the job.

### Skill Routing
`godot-builder` is the master router. It reads the user's prompt and loads
specialized skills based on intent. When adding a new skill:
1. Create `skills/godot-newskill/SKILL.md`
2. Add it to the routing table in `godot-builder/SKILL.md` (Section "Route to Skills")
3. Add keywords to the "Keyword Routing" section
4. Add it to the "Skill Directory" tables

### MCP Server Architecture
- **Entry**: `mcp-server/index.js` — creates an MCP `Server`, registers `ListToolsRequestSchema` and `CallToolRequestSchema`
- **Tools**: `src/tools.js` — exports `TOOL_DEFINITIONS` (array of MCP schemas) and `handleToolCall(name, args)` dispatcher
- **Bridge**: `src/godot-bridge.js` — HTTP client that calls the Godot editor on port 6100
- **Protocol**: MCP SDK over stdio (Claude ↔ MCP server) + HTTP JSON (MCP server ↔ Godot plugin)
- **Environment**: `GODOT_BRIDGE_PORT` (default 6100), `GODOT_PROJECT_PATH` (default `.`)

### Godot Editor Plugin Architecture
- `plugin.gd` is the EditorPlugin entry — creates the HTTP bridge and dock on `_enter_tree()`
- `http_bridge.gd` runs a TCPServer on port 6100, routing requests:
  - `GET /status` → editor state
  - `GET /errors` → error_collector results
  - `POST /run` → run scene in editor
  - `POST /stop` → stop running scene
  - `POST /reload` → rescan filesystem
  - `POST /log` → send message to dock panel
  - `POST /phase` → update phase state, emit phase_updated signal
  - `GET /phase` → return current phase state
  - `GET /scene_tree?max_depth=N` → live scene tree hierarchy
  - `GET /class_info?class_name=X&inherited=bool` → ClassDB lookup
  - `POST /add_node` → add node to edited scene
  - `POST /update_node` → modify node properties
  - `POST /delete_node` → remove node from scene
  - `GET /screenshot?viewport=2d|3d` → editor viewport capture (base64 PNG)
  - `GET /open_scripts` → list open scripts in script editor
- `dock.gd` displays phase progress bar, control buttons (Run/Stop/Reload), error badges, filtered log, and quality gates checklist. Connected to bridge via signals `bridge_log(msg)` and `phase_updated(data)`
- `error_collector.gd` uses two strategies: active script validation + Godot log scanning
- `project_scanner.gd` walks the filesystem for /state responses

### Hook System
Only one hook: the Stop guard.
- `hooks/hooks.json` registers a `Stop` event hook running `stop-guard.sh`
- The script checks for `.claude/.build_in_progress` file
- If present: blocks Claude from stopping (returns `{"decision": "block", ...}`)
- If absent: allows normal exit
- The Director creates the file at Phase 0, removes it at Phase 6

## Common Development Tasks

### Adding a New MCP Tool

1. **Define the schema** in `mcp-server/src/tools.js` — add to `TOOL_DEFINITIONS` array:
```javascript
{
  name: "godot_new_tool",
  description: "What this tool does — be specific so Claude knows when to use it.",
  inputSchema: {
    type: "object",
    properties: {
      param_name: { type: "string", description: "..." },
    },
    required: ["param_name"],
  },
},
```

2. **Add dispatcher case** in `handleToolCall()`:
```javascript
case "godot_new_tool":
  return await toolNewTool(args.param_name);
```

3. **Write the handler** function:
```javascript
async function toolNewTool(paramName) {
  await bridge.sendLog(`[MCP] Doing something with ${paramName}...`);
  // Implementation...
  const result = { /* response data */ };
  await bridge.sendLog(`[MCP] Done: ${paramName}`);
  return result;
}
```

4. If the tool needs a **new Godot endpoint**, add a route in `http_bridge.gd`:
```gdscript
# In _route_request():
"/new_endpoint":
    _handle_new_endpoint(client, body)
```
And add the corresponding bridge function in `godot-bridge.js`:
```javascript
export async function newEndpoint(data) {
  return bridgeRequest("POST", "/new_endpoint", data);
}
```

5. **Add logging** — every tool handler should call `bridge.sendLog()` before and after.

6. **Document it** — add the tool to:
   - `skills/godot-builder/SKILL.md` (MCP tools list)
   - `skills/godot-ops/SKILL.md` (operations reference)
   - `README.md` (MCP Tools table)

### Adding a New Skill

1. Create `skills/godot-newname/SKILL.md` with YAML frontmatter
2. Write the skill content (patterns, code examples, rules, checklists)
3. Register in `godot-builder/SKILL.md`:
   - Add to "Route to Skills" table
   - Add keywords to "Keyword Routing"
   - Add to "Skill Directory" tables
4. If the Director should invoke it during builds, update `godot-director/SKILL.md` phase descriptions
5. Update the README skill count and table

### Modifying the Godot Editor Plugin

Files live in `godot-plugin/addons/ai_game_builder/`. Changes here require:
1. Edit the files in the plugin source
2. Run `setup.sh` again on any test project to copy updated files
3. Restart Godot or disable/re-enable the plugin to pick up changes

**Key GDScript patterns in the plugin:**
- All files are `@tool` scripts (run in editor, not game)
- `http_bridge.gd` uses `TCPServer` + `StreamPeerTCP` for HTTP
- Signals: `bridge.log_message.emit(msg)` → dock picks it up
- `error_collector.gd` caches results, refreshed on `/errors` request
- The plugin.gd stores `editor_interface` reference for editor API access

### Modifying the Asset Generator

`mcp-server/src/asset-generator.js` exports:
- `generatePlaceholder(args)` → SVG string + writes file
- `generatePng(args)` → uses `sharp` to convert SVG → PNG

**Entity type builders** (each returns an SVG inner content string):
`buildCharacter`, `buildEnemy`, `buildBoss`, `buildProjectile`, `buildTile`,
`buildIcon`, `buildBackground`, `buildNpc`, `buildItem`, `buildPickup`, `buildUi`

**Helpers**: `hexToRgb()`, `darken()`, `lighten()`, `withAlpha()`, `uid()`, `simplePrng()`

When adding a new entity type:
1. Add to `DEFAULT_COLORS` map
2. Create a `buildNewType(w, h, color, style)` function
3. Add the type string to the `switch` in the `buildEntity()` router
4. Add the type to `TOOL_DEFINITIONS` enum in `tools.js`
5. Test: call `godot_generate_asset` with the new type

**Visual quality rules for SVGs:**
- Always use `<radialGradient>` or `<linearGradient>` — never flat fills
- Include `<filter id="shadow">` with `<feDropShadow>`
- Layer: shadow → body → core/details → highlights → outline
- Use `darken(color)` for shadows, `lighten(color)` for highlights
- Every entity gets a glow/outline layer using gaussian blur filter

### Updating Documentation

**Files to update** (keep them in sync):
- `README.md` — public-facing, architecture diagram, install steps, skill table, tool table
- `GETTING-STARTED.md` — user walkthrough (6 steps), troubleshooting, project structure
- `GETTING-STARTED.pdf` — regenerate after editing the markdown

**Regenerating the PDF:**
```bash
cd /path/to/godot-ai-builder
pandoc GETTING-STARTED.md -o GETTING-STARTED.pdf --pdf-engine=typst
```

**GitHub URL**: `https://github.com/HubDev-AI/godot-ai-builder`
Always use this URL in all docs and scripts. Check `setup.sh` too — it has inline URLs.

### Adding a New Hook

1. Add the hook definition to `hooks/hooks.json`:
```json
{
  "hooks": {
    "EventName": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/new-hook.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

2. Create the shell script in `hooks/`. It receives JSON on stdin and can return JSON to influence behavior.

3. Available hook events: `Stop`, `PreToolUse`, `PostToolUse`, `Notification`

### Modifying the Director Protocol

The Director (`skills/godot-director/SKILL.md`) controls the 6-phase build:
- Phase 0: PRD (game design doc, visual tier choice)
- Phase 1: Foundation (player, camera, background)
- Phase 2: Abilities (shooting, jumping, interactions)
- Phase 3: Enemies (AI, spawning, combat, scoring)
- Phase 4: UI (menus, HUD, game over, transitions)
- Phase 5: Polish (shaders, particles, screen shake, styled UI)
- Phase 6: QA (error check, edge cases, final verify)

Each phase has **quality gates** — conditions that must pass before moving on.
To modify a phase: edit the phase section in the Director skill and update its gates.

The Director also manages:
- `.claude/.build_in_progress` file (build lock)
- Visual tier selection (procedural/custom/AI-art/prototype)
- Sub-agent delegation for parallel file writing
- PRD template and approval flow

## Checkpoint System

Structured build state saved to `.claude/build_state.json` after each phase completion.

**MCP Tools:**
- `godot_save_build_state` — writes JSON checkpoint (direct filesystem, no bridge)
- `godot_get_build_state` — reads JSON checkpoint, handles missing file gracefully
- `godot_update_phase` — sends phase progress to Godot dock via bridge `POST /phase`

**Data Model** (`.claude/build_state.json`):
```json
{
  "version": "1.0",
  "build_id": "unique-id",
  "timestamp": "ISO-8601",
  "game_name": "...",
  "genre": "...",
  "visual_tier": "procedural",
  "current_phase": { "number": 0, "name": "...", "status": "...", "started_at": "..." },
  "completed_phases": [{ "number": 0, "name": "...", "completed_at": "...", "quality_gates": {} }],
  "files_written": ["scripts/player.gd"],
  "error_history": [{ "file": "...", "message": "...", "resolution": "...", "resolved": true }],
  "test_runs": [{ "phase": 0, "errors": 0, "success": true }],
  "prd_path": "docs/PRD.md",
  "next_steps": ["..."]
}
```

**Resume Flow:**
1. Director calls `godot_get_build_state()` at session start
2. If found: show summary, ask user to continue or start fresh
3. If continue: validate files exist, re-run quality gates for completed phases, resume from current_phase
4. If fresh: delete checkpoint and build lock
5. After Phase 6: delete both `.claude/build_state.json` and `.claude/.build_in_progress`

## Enhanced Dock

The dock (`dock.gd` + `dock.tscn`) provides:
- **Phase progress bar** (0-6) with colored status labels (green=completed, yellow=in_progress)
- **Control buttons**: Run (▶), Stop (■), Reload (↻) — call bridge handlers directly, no HTTP round-trip
- **Error badges**: poll `error_collector` every 2s, show red/green error count + yellow warning count
- **Log filtering**: All / Errors / Progress tabs — message type detected from content keywords
- **Quality gates checklist**: dynamic CheckBox nodes populated from `phase_updated` signal data

**Signal flow**: Director → `godot_update_phase` tool → bridge `POST /phase` → `http_bridge.phase_updated` signal → `dock._on_phase_updated()`

## Cross-Cutting Patterns

### Visual Quality Pipeline
Skills enforce visual quality through documentation rules:
1. `godot-assets` — defines the 4-tier visual system, shader library, entity drawing patterns
2. `godot-player` — visual standard for player entities (layered _draw(), sprite fallback)
3. `godot-enemies` — visual standard for enemy entities (type-specific shapes, hit flash)
4. `godot-effects` — shader effects (hit flash, dissolve, glow), particles, trails
5. `godot-polish` — game feel checklist, shader-based polish, styled UI, transitions
6. `asset-generator.js` — SVG generation with gradients, shadows, highlights

All these must stay consistent. When you change visual patterns in one skill, check the others.

### Skill Cross-References
Skills reference each other. Key dependencies:
- `godot-builder` → routes to ALL skills
- `godot-director` → invokes skills per phase (player in P1, enemies in P3, UI in P4, polish in P5)
- `godot-polish` → references shaders from `godot-assets`, effects from `godot-effects`
- `godot-player` / `godot-enemies` → reference visual patterns from `godot-assets`
- `godot-ops` → documents all MCP tools that other skills call

### Logging Convention (MANDATORY)
Every MCP tool logs to the Godot dock via `bridge.sendLog()`:
- Prefix with `[MCP]` for tool operations
- Prefix with `[Agent: name]` for sub-agent work
- Log BEFORE and AFTER operations
- Include meaningful details: file names, error counts, phase numbers
- Logging is best-effort (silent failure) — never let a log failure break a tool

**Additionally, every tool response includes a `_dock_reminder` field** that reminds the AI to call `godot_log()` after the tool completes. This ensures the AI keeps the Godot dock updated constantly. The `godot_log` and `godot_update_phase` tool descriptions are marked ⚠️ MANDATORY to further reinforce this requirement.

### Error Handling in MCP Tools
- Bridge requests have a 5-second timeout
- `isConnected()` checks by calling `getStatus()` — swallows errors
- `sendLog()` wraps in try/catch — never throws
- Tool handlers should throw descriptive errors — `index.js` catches and returns `isError: true`
- `project.godot` parser is lenient — returns `{}` on missing file

## Testing During Development

### Testing MCP Tools
```bash
# Install dependencies
cd mcp-server && npm install

# Test the server starts
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js

# Test with a running Godot instance (plugin enabled)
# The MCP server needs GODOT_PROJECT_PATH set to a real project
GODOT_PROJECT_PATH=/path/to/test/project node index.js
```

### Testing the Godot Plugin
1. Copy files: `./setup.sh /path/to/test/project`
2. Open test project in Godot
3. Enable plugin in Project Settings → Plugins
4. Check bottom dock appears with green status
5. Test HTTP endpoints: `curl http://localhost:6100/status`

### Testing Skills
Skills are just markdown — test by loading the plugin and using the skill:
```bash
cd /path/to/test/project
claude --plugin-dir /path/to/godot-ai-builder
# Then: /godot-ai-builder:godot-skillname
```

### Testing Asset Generation
```bash
# Quick test: generate assets and inspect the SVGs
cd /path/to/test/project
claude --plugin-dir /path/to/godot-ai-builder
# Then ask: "Generate a character sprite" or "Generate an enemy sprite"
# Check the output SVG in assets/sprites/
```

## Pitfalls & Lessons Learned

### Edit Tool Accuracy
When editing files, ALWAYS re-read the file first to get exact strings. Old strings
from memory or previous sessions may not match the current file contents. Failed edits
cascade — if one Edit fails in a parallel batch, siblings may fail too.

### Skill Text is Everything
There is no runtime config for skills. The SKILL.md content IS the instruction set.
If Claude doesn't do something, the skill text needs to be more explicit. If Claude
does something wrong, the skill needs a rule against it.

### SVG Quality Matters
Early SVGs were flat colored shapes (triangles, rectangles). Users found them ugly.
The asset generator was rewritten with layered gradients, shadows, highlights, and
entity-specific builders. When modifying SVGs, always maintain:
- Gradient fills (radialGradient or linearGradient)
- Drop shadow filter
- At least 3 visual layers (shadow, body, highlight)
- Glow/outline effects for important entities

### Cross-Skill Consistency
All visual skills must agree on patterns. A change to how player visuals work
(`godot-player`) must be reflected in the effects that apply to players
(`godot-effects`, `godot-polish`). The visual checklist in `godot-assets` is
the authoritative source.

### The project.godot Fragility
Claude has a tendency to overwrite `project.godot` sections. The builder skill
explicitly warns against this: "ALWAYS read before modifying, NEVER overwrite,
MUST preserve [autoload]". If you see game-breaking bugs after builds, check
if project.godot sections were stripped.

### PDF Regeneration
After updating `GETTING-STARTED.md`, always regenerate the PDF:
```bash
pandoc GETTING-STARTED.md -o GETTING-STARTED.pdf --pdf-engine=typst
```
Both pandoc and typst must be installed. On macOS: `brew install pandoc typst`.

### setup.sh URL
The `setup.sh` file contains inline URLs for marketplace instructions. Keep these
in sync with the real GitHub URL (`https://github.com/HubDev-AI/godot-ai-builder`).

### MCP Server Auto-Start
The MCP server is launched automatically by Claude Code via `.mcp.json`. Users
don't need to start it manually. The config uses `${CLAUDE_PLUGIN_ROOT}` to
resolve paths relative to the plugin directory.

### Error Collector Strategies
`error_collector.gd` uses two strategies:
1. **Active script validation** — parses .gd files for syntax errors
2. **Log scanning** — reads Godot's output log for runtime errors
Both run on `/errors` request. The active strategy catches errors that Godot's
log doesn't always surface (e.g., scripts that fail to parse).

## Commit Convention

Follow the existing commit style:
```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types used: `feat`, `fix`, `docs`, `refactor`
Recent examples:
- `feat: visual quality overhaul — layered procedural visuals, shaders, polished SVGs`
- `fix: rewrite error collector to actively validate scripts`
- `docs: update guides with scope choice, godot_log tool, and dock logging`
- `feat: add godot_log MCP tool + dock console logging for all operations`
