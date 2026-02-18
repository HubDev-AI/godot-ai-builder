#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, handleToolCall, getErrorCount } from "./src/tools.js";

const server = new Server(
  { name: "godot-ai-builder", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

// Tools that skip the background error check (they already check, or are trivial)
const SKIP_ERROR_CHECK = new Set([
  "godot_log",
  "godot_update_phase",
  "godot_get_errors",
  "godot_reload_filesystem",
  "godot_get_build_state",
  "godot_read_project_setting",
  "godot_get_class_info",
]);

// Tools that represent concrete progress (file/scene/runtime/progress mutation).
const MUTATING_PROGRESS_TOOLS = new Set([
  "godot_generate_asset",
  "godot_generate_asset_pack",
  "godot_install_addon",
  "godot_apply_integration_pack",
  "godot_add_node",
  "godot_update_node",
  "godot_delete_node",
  "godot_save_build_state",
  "godot_update_phase",
  "godot_run_scene",
  "godot_stop_scene",
  "godot_score_poc_quality",
]);

const STALL_GUARD_INITIAL_LIMIT = parsePositiveInt(
  process.env.GODOT_STALL_GUARD_INITIAL,
  4
);
const STALL_GUARD_STEADY_LIMIT = parsePositiveInt(
  process.env.GODOT_STALL_GUARD_STEADY,
  6
);

const stallGuardState = {
  totalCalls: 0,
  nonMutatingStreak: 0,
  sawMutatingProgress: false,
  lastMutatingTool: "",
  lastMutatingCall: 0,
};

function parsePositiveInt(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function isMutatingProgressTool(name) {
  return MUTATING_PROGRESS_TOOLS.has(name);
}

function currentStallLimit() {
  return stallGuardState.sawMutatingProgress
    ? STALL_GUARD_STEADY_LIMIT
    : STALL_GUARD_INITIAL_LIMIT;
}

function updateStallGuard(name) {
  stallGuardState.totalCalls += 1;

  if (isMutatingProgressTool(name)) {
    stallGuardState.nonMutatingStreak = 0;
    stallGuardState.sawMutatingProgress = true;
    stallGuardState.lastMutatingTool = name;
    stallGuardState.lastMutatingCall = stallGuardState.totalCalls;
    return;
  }

  // Dock logs are visibility signals; don't count them as progress or stall.
  if (name === "godot_log") {
    return;
  }

  stallGuardState.nonMutatingStreak += 1;
}

function getStallGuardPayload() {
  const limit = currentStallLimit();
  if (stallGuardState.nonMutatingStreak < limit) return null;

  return {
    triggered: true,
    non_mutating_streak: stallGuardState.nonMutatingStreak,
    limit,
    last_progress_tool: stallGuardState.lastMutatingTool || null,
    last_progress_call: stallGuardState.lastMutatingCall || null,
    action_required:
      "STALL GUARD: Too many non-mutating MCP calls in a row. " +
      "Your next step must be concrete progress: write game files, " +
      "generate/apply assets, mutate scene nodes, run scene, update phase, or score quality. " +
      "If blocked, print STALLED with the exact blocker.",
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args || {});
    updateStallGuard(name);

    // ── Append live error count to every tool response ──
    // This ensures the AI ALWAYS sees its current error state.
    // Tools that already check errors or are lightweight skip this.
    if (!SKIP_ERROR_CHECK.has(name)) {
      try {
        const errCount = await getErrorCount();
        result._error_count = errCount;
        if (errCount > 0) {
          result._action_required =
            `⛔ ${errCount} compilation errors exist. You MUST call godot_get_errors() ` +
            `and fix ALL errors before writing more files or completing any phase.`;
        }
      } catch {
        // Bridge not available — skip error check
      }
    }

    // Remind the AI to keep the Godot dock updated
    if (name !== "godot_log" && name !== "godot_update_phase") {
      result._dock_reminder =
        "IMPORTANT: Call godot_log() now to tell the user what you are doing next. " +
        "The Godot dock panel is the user's primary progress monitor. " +
        "Also call godot_update_phase() whenever you start or finish a build phase.";
    }

    const stallGuard = getStallGuardPayload();
    if (stallGuard) {
      result._stall_guard = stallGuard;
      if (stallGuard.non_mutating_streak >= stallGuard.limit + 2) {
        const hardAction =
          "STALL GUARD HARD LIMIT: Stop planning loops. " +
          "Immediately execute a mutating step or report STALLED with blocker.";
        result._action_required = result._action_required
          ? `${result._action_required} ${hardAction}`
          : hardAction;
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
