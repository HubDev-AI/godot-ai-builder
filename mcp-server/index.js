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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args || {});

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
