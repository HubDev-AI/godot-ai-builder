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
# 6. Done
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
echo ""
echo "  4. Install the Claude Code plugin (choose one):"
echo ""
echo "     Option A — Load directly from this directory:"
echo "       cd $GODOT_PROJECT"
echo "       claude --plugin-dir $SCRIPT_DIR"
echo ""
echo "     Option B — Install from marketplace:"
echo "       /plugin marketplace add https://github.com/you/godot-ai-builder"
echo "       /plugin install godot-ai-builder"
echo ""
echo "  5. Tell Claude: \"Create a 2D shooter with enemies and score\""
echo ""
