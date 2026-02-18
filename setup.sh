#!/usr/bin/env bash
set -euo pipefail

# AI Game Builder — Godot Editor Plugin Setup
# Usage: ./setup.sh /path/to/your/godot/project
#
# This script installs the Godot editor plugin and knowledge base.
# The Claude Code side (skills, hooks, MCP) is handled by the plugin system:
#   /plugin marketplace add https://github.com/you/godot-ai-builder
#   /plugin install godot-ai-builder

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "  AI Game Builder — Godot Editor Setup"
echo "================================================"
echo ""

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required (v20+). Install from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js v20+ required (found v$NODE_VERSION)"
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Get Godot project path
# ---------------------------------------------------------------------------
GODOT_PROJECT="${1:-}"

if [ -z "$GODOT_PROJECT" ]; then
    echo "Usage: ./setup.sh /path/to/your/godot/project"
    echo ""
    echo "This installs the Godot editor plugin (HTTP bridge) into your project."
    echo ""
    echo "For the Claude Code side, use the plugin system:"
    echo "  1. Open Claude Code"
    echo "  2. Run: /plugin install godot-ai-builder"
    echo "  OR load locally: claude --plugin-dir $SCRIPT_DIR"
    exit 1
fi

GODOT_PROJECT="$(cd "$GODOT_PROJECT" && pwd)"

if [ ! -f "$GODOT_PROJECT/project.godot" ]; then
    echo "Error: No project.godot found in $GODOT_PROJECT"
    echo "Please provide a valid Godot project directory."
    exit 1
fi

echo -e "${GREEN}Godot project:${NC} $GODOT_PROJECT"
echo ""

# ---------------------------------------------------------------------------
# 3. Install MCP server dependencies
# ---------------------------------------------------------------------------
echo "Installing MCP server dependencies..."
cd "$SCRIPT_DIR/mcp-server"
npm install --silent
echo -e "${GREEN}✓${NC} MCP server ready"

# ---------------------------------------------------------------------------
# 4. Copy Godot editor plugin
# ---------------------------------------------------------------------------
echo "Installing Godot editor plugin..."
mkdir -p "$GODOT_PROJECT/addons/ai_game_builder"
cp -r "$SCRIPT_DIR/godot-plugin/addons/ai_game_builder/"* "$GODOT_PROJECT/addons/ai_game_builder/"
echo -e "${GREEN}✓${NC} Plugin installed to $GODOT_PROJECT/addons/ai_game_builder/"

# ---------------------------------------------------------------------------
# 5. Copy knowledge base (optional reference docs)
# ---------------------------------------------------------------------------
echo "Installing knowledge base..."
mkdir -p "$GODOT_PROJECT/knowledge"
cp -r "$SCRIPT_DIR/knowledge/"* "$GODOT_PROJECT/knowledge/"
echo -e "${GREEN}✓${NC} Knowledge base installed"

# ---------------------------------------------------------------------------
# 6. Create local launchers (backend switch + Claude compatibility wrapper)
# ---------------------------------------------------------------------------
echo "Creating launcher scripts..."
LAUNCHER="$GODOT_PROJECT/start-ai-builder.sh"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR"
BACKEND="\${AI_BUILDER_BACKEND:-cloud}"

cd "\$PROJECT_DIR"

case "\$BACKEND" in
  cloud|claude)
    if ! command -v claude >/dev/null 2>&1; then
      echo "Error: claude CLI not found in PATH."
      exit 1
    fi
    echo "Starting AI Game Builder with backend: \$BACKEND"
    echo "Project: \$PROJECT_DIR"
    echo "Plugin: \$PLUGIN_DIR"
    exec claude --plugin-dir "\$PLUGIN_DIR" "\$@"
    ;;
  local_codex|codex)
    if ! command -v codex >/dev/null 2>&1; then
      echo "Error: codex CLI not found in PATH."
      exit 1
    fi
    echo "Starting AI Game Builder with backend: \$BACKEND"
    echo "Project: \$PROJECT_DIR"
    echo "Using Codex local execution mode."
    exec codex --cd "\$PROJECT_DIR" "\$@"
    ;;
  *)
    echo "Error: unknown AI_BUILDER_BACKEND '\$BACKEND'."
    echo "Supported values: cloud, local_codex"
    exit 1
    ;;
esac
EOF
chmod +x "$LAUNCHER"
echo -e "${GREEN}✓${NC} Launcher created at $LAUNCHER"

# Backward compatible wrapper.
LEGACY_LAUNCHER="$GODOT_PROJECT/start-claude-ai-builder.sh"
cat > "$LEGACY_LAUNCHER" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export AI_BUILDER_BACKEND=cloud
exec "\$(cd "\$(dirname "\$0")" && pwd)/start-ai-builder.sh" "\$@"
EOF
chmod +x "$LEGACY_LAUNCHER"
echo -e "${GREEN}✓${NC} Legacy launcher created at $LEGACY_LAUNCHER"

# ---------------------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------------------
echo ""
echo "================================================"
echo -e "${GREEN}  Godot editor setup complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Open your Godot project in the editor"
echo "  2. Go to Project → Project Settings → Plugins"
echo "  3. Enable \"AI Game Builder\""
echo "  4. Close any existing Claude sessions (MCP tools load only at startup)"
echo ""
echo "  5. Start the agent backend:"
echo ""
echo "     Recommended:"
echo "       cd $GODOT_PROJECT"
echo "       ./start-ai-builder.sh"
echo ""
echo "     Cloud backend (Claude):"
echo "       AI_BUILDER_BACKEND=cloud ./start-ai-builder.sh"
echo ""
echo "     Local backend (Codex):"
echo "       AI_BUILDER_BACKEND=local_codex ./start-ai-builder.sh"
echo ""
echo "     Equivalent manual command:"
echo "       claude --plugin-dir $SCRIPT_DIR"
echo ""
echo "     Marketplace option:"
echo "       /plugin marketplace add https://github.com/you/godot-ai-builder"
echo "       /plugin install godot-ai-builder"
echo ""
echo "  6. In Claude, verify MCP tools are loaded:"
echo "     Ask: \"What MCP tools are available?\""
echo "     Expected: godot_get_project_state, godot_run_scene, godot_get_errors, ..."
echo ""
echo "  7. Tell Claude what to build:"
echo ""
echo "     From a prompt:"
echo "       \"Create a 2D shooter with enemies and score\""
echo ""
echo "     From a design folder:"
echo "       \"Build the game from the docs in ~/my-game-design/\""
echo ""
echo "  The MCP server starts automatically when Claude loads this plugin."
echo ""
