#!/usr/bin/env bash
set -euo pipefail

# AI Game Builder — One-command setup
# Usage: ./setup.sh /path/to/your/godot/project

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "  AI Game Builder — Setup"
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
    echo "This will:"
    echo "  1. Install the MCP server dependencies"
    echo "  2. Copy the Godot plugin into your project"
    echo "  3. Configure Claude Code MCP settings"
    echo "  4. Copy the CLAUDE.md knowledge base"
    echo "  5. Install Claude Code skills (14 game generation skills)"
    echo "  6. Install Stop hook (prevents Claude from quitting mid-build)"
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
# 4. Copy Godot plugin
# ---------------------------------------------------------------------------
echo "Installing Godot plugin..."
mkdir -p "$GODOT_PROJECT/addons/ai_game_builder"
cp -r "$SCRIPT_DIR/godot-plugin/addons/ai_game_builder/"* "$GODOT_PROJECT/addons/ai_game_builder/"
echo -e "${GREEN}✓${NC} Plugin installed to $GODOT_PROJECT/addons/ai_game_builder/"

# ---------------------------------------------------------------------------
# 5. Copy CLAUDE.md and knowledge base
# ---------------------------------------------------------------------------
echo "Installing knowledge base..."
mkdir -p "$GODOT_PROJECT/.claude"

if [ -f "$GODOT_PROJECT/.claude/CLAUDE.md" ]; then
    echo -e "${YELLOW}  CLAUDE.md already exists — appending AI Game Builder section${NC}"
    echo "" >> "$GODOT_PROJECT/.claude/CLAUDE.md"
    echo "# --- AI Game Builder (auto-appended) ---" >> "$GODOT_PROJECT/.claude/CLAUDE.md"
    cat "$SCRIPT_DIR/.claude/CLAUDE.md" >> "$GODOT_PROJECT/.claude/CLAUDE.md"
else
    cp "$SCRIPT_DIR/.claude/CLAUDE.md" "$GODOT_PROJECT/.claude/CLAUDE.md"
fi

mkdir -p "$GODOT_PROJECT/knowledge"
cp -r "$SCRIPT_DIR/knowledge/"* "$GODOT_PROJECT/knowledge/"
echo -e "${GREEN}✓${NC} Knowledge base installed"

# ---------------------------------------------------------------------------
# 6. Install Claude Code skills
# ---------------------------------------------------------------------------
echo "Installing Claude Code skills..."
mkdir -p "$GODOT_PROJECT/.claude/skills"
cp -r "$SCRIPT_DIR/.claude/skills/"* "$GODOT_PROJECT/.claude/skills/"
SKILL_COUNT=$(ls -d "$GODOT_PROJECT/.claude/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $SKILL_COUNT skills installed"

# ---------------------------------------------------------------------------
# 7. Install Stop hook (prevents quitting mid-build)
# ---------------------------------------------------------------------------
echo "Installing Stop hook..."
mkdir -p "$GODOT_PROJECT/.claude/hooks"
cp "$SCRIPT_DIR/hooks/stop-guard.sh" "$GODOT_PROJECT/.claude/hooks/stop-guard.sh"
chmod +x "$GODOT_PROJECT/.claude/hooks/stop-guard.sh"
echo -e "${GREEN}✓${NC} Stop hook installed"

# ---------------------------------------------------------------------------
# 8. Configure Claude Code MCP
# ---------------------------------------------------------------------------
echo "Configuring Claude Code MCP..."
MCP_CONFIG_DIR="$HOME/.claude"
mkdir -p "$MCP_CONFIG_DIR"

MCP_INDEX="$SCRIPT_DIR/mcp-server/index.js"

# Create or update the Claude MCP settings
CLAUDE_CONFIG="$GODOT_PROJECT/.claude/settings.json"

if [ -f "$CLAUDE_CONFIG" ]; then
    # Check if already configured
    if grep -q "godot-ai-builder" "$CLAUDE_CONFIG" 2>/dev/null; then
        echo -e "${YELLOW}  MCP already configured in project settings${NC}"
    else
        echo -e "${YELLOW}  Existing settings found — please add the MCP config manually:${NC}"
        echo ""
        echo "  Add to $CLAUDE_CONFIG under \"mcpServers\":"
        echo "    \"godot-ai-builder\": {"
        echo "      \"command\": \"node\","
        echo "      \"args\": [\"$MCP_INDEX\"],"
        echo "      \"env\": {"
        echo "        \"GODOT_PROJECT_PATH\": \"$GODOT_PROJECT\","
        echo "        \"GODOT_BRIDGE_PORT\": \"6100\""
        echo "      }"
        echo "    }"
    fi
else
    cat > "$CLAUDE_CONFIG" << CONFIGEOF
{
  "mcpServers": {
    "godot-ai-builder": {
      "command": "node",
      "args": ["$MCP_INDEX"],
      "env": {
        "GODOT_PROJECT_PATH": "$GODOT_PROJECT",
        "GODOT_BRIDGE_PORT": "6100"
      }
    }
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"\$CLAUDE_PROJECT_DIR/.claude/hooks/stop-guard.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
CONFIGEOF
    echo -e "${GREEN}✓${NC} MCP + hooks configured at $CLAUDE_CONFIG"
fi

# ---------------------------------------------------------------------------
# 9. Done
# ---------------------------------------------------------------------------
echo ""
echo "================================================"
echo -e "${GREEN}  Setup complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Open your Godot project in the Godot editor"
echo "  2. Go to Project → Project Settings → Plugins"
echo "  3. Enable \"AI Game Builder\""
echo "  4. Open Claude Code in your project directory:"
echo "     cd $GODOT_PROJECT && claude"
echo "  5. Tell Claude: \"Create a 2D platformer with a player, enemies, and coins\""
echo ""
echo "Claude Code will write the game files, tell Godot to reload,"
echo "run the scene, check for errors, and fix them automatically."
echo ""
echo "The Stop hook ensures Claude won't quit mid-build."
echo "It automatically disengages when the Director completes all phases."
echo ""
