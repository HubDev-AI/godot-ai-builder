#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, handleToolCall } from "./src/tools.js";

const server = new Server(
  { name: "godot-ai-builder", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args || {});
    // Remind the AI to keep the Godot dock updated after every tool call
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
