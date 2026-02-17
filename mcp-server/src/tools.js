/**
 * MCP Tool definitions and handlers for Godot AI Game Builder.
 */
import { readdir, readFile, writeFile, mkdir, stat, cp, rm } from "fs/promises";
import { resolve, extname, relative, dirname } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import * as bridge from "./godot-bridge.js";
import { parseScene, resToAbsolute } from "./scene-parser.js";
import {
  generatePlaceholder,
  generatePng,
  generateAssetPack,
} from "./asset-generator.js";

const PROJECT_PATH = process.env.GODOT_PROJECT_PATH || ".";
const QUALITY_REPORTS_DIR = resolve(PROJECT_PATH, ".claude", "quality_reports");
const INTEGRATION_PACK_REPORTS_DIR = resolve(PROJECT_PATH, ".claude", "integration_packs");
const ADDON_CATALOG_PATH = new URL("../addons/catalog.json", import.meta.url);
const execFileAsync = promisify(execFile);
let addonCatalogCache = null;

const POC_SCORE_WEIGHTS = {
  core_loop_fun: 20,
  controls_game_feel: 20,
  progression_variety: 20,
  encounter_depth: 15,
  visual_polish_cohesion: 15,
  ux_onboarding_feedback: 10,
};

const POC_REQUIRED_HARD_GATES = [
  "zero_script_errors",
  "no_critical_warnings",
  "play_loop_complete",
  "controls_clear",
  "no_soft_lock",
  "quality_gates_passed",
];

const POC_REQUIRED_VISUAL_CHECKS = [
  "named_art_direction",
  "palette_discipline",
  "silhouette_readability",
  "layering_depth",
  "feedback_clarity",
  "ui_theme_consistency",
  "no_raw_placeholder_feel",
];

// ---------------------------------------------------------------------------
// Tool definitions (MCP schema)
// ---------------------------------------------------------------------------
export const TOOL_DEFINITIONS = [
  {
    name: "godot_get_project_state",
    description:
      "Get the current Godot project state: project name, scenes, scripts, resources, settings, and whether the editor is connected. Always call this first to understand the project before generating code. After calling this, use godot_log() to report what you found to the Godot dock panel.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "godot_run_scene",
    description:
      "Run a scene in the Godot editor. If scene_path is omitted, runs the main scene. Requires the Godot editor to be open with the AI Game Builder plugin enabled. After calling this, use godot_log() to report the test results to the dock.",
    inputSchema: {
      type: "object",
      properties: {
        scene_path: {
          type: "string",
          description:
            'Optional res:// path to a specific scene. Runs main scene if empty.',
        },
      },
    },
  },
  {
    name: "godot_stop_scene",
    description: "Stop the currently running scene in the Godot editor.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "godot_get_errors",
    description:
      "Get current errors and warnings from the Godot editor. By default runs headless Godot validation which returns DETAILED error messages with file paths, line numbers, and actual error text (takes 2-5 seconds). Set detailed=false for a fast check that only tells you WHICH files have errors but not WHY. After calling this, use godot_log() to report the results to the dock (e.g. 'Checked errors: 2 errors found in player.gd' or '✓ 0 errors').",
    inputSchema: {
      type: "object",
      properties: {
        detailed: {
          type: "boolean",
          description:
            "Run headless Godot validation for detailed error messages with line numbers (default: true). Set to false for a fast check.",
        },
      },
    },
  },
  {
    name: "godot_reload_filesystem",
    description:
      "Tell the Godot editor to rescan the filesystem. Call this after writing or modifying files so the editor picks up changes. This tool AUTOMATICALLY checks for errors after reloading and returns the error count in _error_count. If errors are found, _action_required will tell you to fix them BEFORE writing more files.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "godot_parse_scene",
    description:
      "Parse a .tscn scene file and return its node tree, scripts, and resources. Useful for understanding existing scene structure before modifying it.",
    inputSchema: {
      type: "object",
      properties: {
        scene_path: {
          type: "string",
          description: "Path to the .tscn file (res:// or absolute)",
        },
      },
      required: ["scene_path"],
    },
  },
  {
    name: "godot_generate_asset",
    description:
      "Generate a polished sprite asset (SVG or PNG) with layered shading, highlights, and outlines. Use for production-ready placeholders, not flat shapes.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Asset filename (no extension)" },
        width: { type: "number", description: "Width in pixels (default: 64)" },
        height: {
          type: "number",
          description: "Height in pixels (default: 64)",
        },
        type: {
          type: "string",
          enum: [
            "character",
            "enemy",
            "projectile",
            "tile",
            "icon",
            "background",
            "npc",
            "item",
            "ui",
            "boss",
            "pickup",
          ],
          description: "Asset type — determines shape and default color",
        },
        style: {
          type: "string",
          enum: ["sci-fi", "fantasy", "minimal", "neon", "dark"],
          description: "Visual style preset (default: sci-fi)",
        },
        color: {
          type: "string",
          description: "Primary hex color (auto-picked if omitted)",
        },
        format: {
          type: "string",
          enum: ["svg", "png"],
          description: "Output format (default: svg)",
        },
        output_dir: {
          type: "string",
          description: "Output directory (default: res://assets/sprites)",
        },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "godot_generate_asset_pack",
    description:
      "Generate a coherent set of assets for a game genre in one call (player, enemies, projectiles, pickups, UI icons, backgrounds). Preferred for full-game builds.",
    inputSchema: {
      type: "object",
      properties: {
        preset: {
          type: "string",
          enum: [
            "top_down_shooter",
            "arena_survivor",
            "platformer",
            "rpg",
            "tower_defense",
          ],
          description: "Genre preset for default asset list",
        },
        style: {
          type: "string",
          enum: ["sci-fi", "fantasy", "minimal", "neon", "dark"],
          description: "Visual style preset (default: sci-fi)",
        },
        format: {
          type: "string",
          enum: ["svg", "png"],
          description: "Output format (default: svg)",
        },
        output_dir: {
          type: "string",
          description: "Output directory (default: res://assets/sprites)",
        },
        include_background: {
          type: "boolean",
          description: "Include background assets (default: true)",
        },
        include_ui: {
          type: "boolean",
          description: "Include UI/icon assets (default: true)",
        },
        prefix: {
          type: "string",
          description:
            "Optional filename prefix to avoid collisions (e.g. run1, cyber)",
        },
        assets: {
          type: "array",
          description:
            "Optional custom asset list. If provided, overrides preset entries.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "character",
                  "enemy",
                  "projectile",
                  "tile",
                  "icon",
                  "background",
                  "npc",
                  "item",
                  "ui",
                  "boss",
                  "pickup",
                ],
              },
              width: { type: "number" },
              height: { type: "number" },
              color: { type: "string" },
            },
            required: ["name", "type"],
          },
        },
      },
    },
  },
  {
    name: "godot_scan_project_files",
    description:
      "Scan the project directory for all game files (scripts, scenes, resources, assets). Works without the Godot editor running — reads the filesystem directly.",
    inputSchema: {
      type: "object",
      properties: {
        extensions: {
          type: "array",
          items: { type: "string" },
          description:
            'File extensions to include (default: ["gd","tscn","tres","svg","png","ogg","wav"])',
        },
      },
    },
  },
  {
    name: "godot_read_project_setting",
    description:
      "Read a value from the Godot project.godot file. Common keys: application/config/name, application/run/main_scene, display/window/size/viewport_width",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Setting key path, e.g. application/run/main_scene",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "godot_list_addons",
    description:
      "List curated add-ons from the internal catalog with compatibility metadata. Use this before selecting integration packs.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category filter (e.g. polish_camera)",
        },
      },
    },
  },
  {
    name: "godot_install_addon",
    description:
      "Install a curated add-on into the current project using catalog metadata. Returns verification status and remediation on failure.",
    inputSchema: {
      type: "object",
      properties: {
        addon_id: {
          type: "string",
          description: "Catalog add-on ID (e.g. phantom_camera)",
        },
        force: {
          type: "boolean",
          description:
            "Reinstall even when the add-on already verifies (default: false).",
        },
      },
      required: ["addon_id"],
    },
  },
  {
    name: "godot_verify_addon",
    description:
      "Verify that a curated add-on is installed by checking required files and project signals.",
    inputSchema: {
      type: "object",
      properties: {
        addon_id: {
          type: "string",
          description: "Catalog add-on ID to verify",
        },
      },
      required: ["addon_id"],
    },
  },
  {
    name: "godot_apply_integration_pack",
    description:
      "Apply a curated integration pack. For PoC, pack_polish installs and verifies Phantom Camera. In strict mode, this fails loudly when required add-ons are unhealthy.",
    inputSchema: {
      type: "object",
      properties: {
        pack_id: {
          type: "string",
          enum: ["pack_polish"],
          description: "Integration pack ID",
        },
        strict: {
          type: "boolean",
          description:
            "When true (default), reject the pack if any required add-on fails.",
        },
      },
      required: ["pack_id"],
    },
  },
  {
    name: "godot_score_poc_quality",
    description:
      "Score a PoC run using the weighted anti-tutorial rubric and enforce the max-iteration policy. Returns go/needs_iteration/no_go with targeted next_actions.",
    inputSchema: {
      type: "object",
      properties: {
        benchmark_id: {
          type: "string",
          description: "Optional benchmark ID (e.g. poc_prompt_01)",
        },
        run_id: {
          type: "string",
          description: "Optional stable run identifier",
        },
        iteration_count: {
          type: "number",
          description: "Current quality iteration number (1..N)",
        },
        max_iterations: {
          type: "number",
          description: "Maximum allowed quality iterations (default: 3)",
        },
        hard_gates: {
          type: "object",
          description: "Hard gate boolean map from the evaluator checklist",
        },
        anti_tutorial_visual_checks: {
          type: "object",
          description: "Anti-tutorial visual boolean map from the evaluator checklist",
        },
        scores: {
          type: "object",
          description: "Category scores (1-5) using the PoC rubric keys",
        },
        signature_moments: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of notable signature gameplay moments",
        },
        notes: {
          type: "string",
          description: "Optional evaluator notes",
        },
      },
      required: [
        "iteration_count",
        "hard_gates",
        "anti_tutorial_visual_checks",
        "scores"
      ],
    },
  },
  {
    name: "godot_log",
    description:
      "⚠️ MANDATORY — Send a progress message to the Godot editor dock panel. You MUST call this tool constantly throughout the entire build process. The dock panel is the user's PRIMARY way to monitor what you are doing — if you don't call this, the user sees NOTHING happening and thinks the build is stuck.\n\nYou MUST call godot_log:\n- BEFORE writing every file (what you're about to write and why)\n- AFTER writing every file (confirm it's done, line count)\n- When starting each build phase\n- When finishing each build phase (with quality gate results)\n- When encountering errors (what the error is)\n- When fixing errors (what the fix was)\n- Before and after running scenes\n- Before and after checking errors\n- When making any decision (what you chose and why)\n\nAim for 3-5 godot_log calls per file write. Call it between every 2-3 other tool calls at minimum. MORE IS BETTER — the user wants constant visibility.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "Message to display in the Godot dock panel. Be specific and descriptive. Examples: 'Writing scripts/player.gd — WASD movement, mouse aim, shooting (layer 1, mask 4)...', '✓ scripts/player.gd written — 85 lines', 'Phase 2: Player Abilities — complete. 4/4 gates passed.', 'ERROR in main.gd:15 — GameManager not found, fixing autoload registration...', '✓ Error fixed, retesting...'",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "godot_save_build_state",
    description:
      "Save the current build state to a checkpoint file (.claude/build_state.json). MANDATORY: Call this after each phase completes to enable session resumption if Claude is interrupted. Also call godot_log() to confirm the checkpoint was saved. The state object should include: version, build_id, timestamp, game_name, genre, visual_tier, current_phase, completed_phases, files_written, error_history, test_runs, prd_path, next_steps.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "object",
          description: "The complete build state object to save",
        },
      },
      required: ["state"],
    },
  },
  {
    name: "godot_get_build_state",
    description:
      "Read the build checkpoint file (.claude/build_state.json) to check for interrupted builds. Call this at the start of every build session. Returns {found: true, state: {...}} if a checkpoint exists, or {found: false, state: null} if no checkpoint exists.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "godot_get_latest_quality_report",
    description:
      "Read the most recent saved quality report(s) from .claude/quality_reports. Useful for comparing repeated gate failures across attempts and planning targeted fixes.",
    inputSchema: {
      type: "object",
      properties: {
        phase_number: {
          type: "number",
          description:
            "Optional phase filter (e.g. 5 or 6). When omitted, returns latest reports across all phases.",
        },
        limit: {
          type: "number",
          description:
            "Maximum reports to return (default: 1, max: 10).",
        },
      },
    },
  },
  {
    name: "godot_evaluate_quality_gates",
    description:
      "Evaluate objective quality gates for a phase using project files and scene/config signals. For Phase 5+ this checks visual polish proxies (assets, FX, UI styling, layering, feedback cues). For Phase 6 it also checks flow/readiness proxies (main scene, menu/restart/pause flow markers, no pass stubs). Use this before godot_update_phase(..., 'completed') to see what is still missing. Saves a structured report to .claude/quality_reports.",
    inputSchema: {
      type: "object",
      properties: {
        phase_number: {
          type: "number",
          description: "Phase number to evaluate (0-6)",
        },
        phase_name: {
          type: "string",
          description: "Optional phase name for logs/reporting",
        },
        quality_gates: {
          type: "object",
          description:
            "Optional gate map already reported by the agent; merged with computed auto gates in output",
        },
      },
      required: ["phase_number"],
    },
  },
  {
    name: "godot_update_phase",
    description:
      "⚠️ MANDATORY — Update the phase progress bar in the Godot dock panel. You MUST call this at the START of every build phase (status='in_progress') and at the END of every build phase (status='completed').\n\n⛔ HARD GATE #1: When status='completed', this tool AUTOMATICALLY checks for compilation errors. If ANY errors exist, completion is REJECTED.\n⛔ HARD GATE #2 (Phase 5/6): This tool also runs objective quality-gate evaluation. If required quality gates fail, completion is REJECTED with failed gate details.\n\nCall pattern:\n1. Phase starts: godot_update_phase(N, 'Phase Name', 'in_progress')\n2. Fix errors first: godot_get_errors() → fix → godot_reload_filesystem() → repeat until 0\n3. Evaluate quality (especially Phase 5/6): godot_evaluate_quality_gates(N)\n4. Phase ends: godot_update_phase(N, 'Phase Name', 'completed', {gate1: true, ...})\n\nPhase numbers: 0=Discovery/PRD, 1=Foundation, 2=Player Abilities, 3=Enemies, 4=UI & Game Flow, 5=Polish, 6=Final QA",
    inputSchema: {
      type: "object",
      properties: {
        phase_number: {
          type: "number",
          description: "Phase number (0-6)",
        },
        phase_name: {
          type: "string",
          description: "Phase name (e.g. 'Foundation', 'Enemies & Challenges')",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
          description: "Phase status",
        },
        quality_gates: {
          type: "object",
          description: "Quality gate results — keys are gate names, values are booleans",
        },
      },
      required: ["phase_number", "phase_name", "status"],
    },
  },
  // --- Editor Integration Tools ---
  {
    name: "godot_get_scene_tree",
    description:
      "Get the full node hierarchy of the currently edited scene in the Godot editor. Returns node names, types, paths, attached scripts, and visibility. Use this to verify scene structure after creating nodes or writing .tscn files.",
    inputSchema: {
      type: "object",
      properties: {
        max_depth: {
          type: "number",
          description: "Maximum tree depth to return (default: 10)",
        },
      },
    },
  },
  {
    name: "godot_get_class_info",
    description:
      "Get properties, methods, and signals for any Godot built-in class via ClassDB. Use this before writing scripts to verify correct property names, method signatures, and available signals. Prevents wrong API usage.",
    inputSchema: {
      type: "object",
      properties: {
        class_name: {
          type: "string",
          description:
            'Godot class name (e.g. "CharacterBody2D", "Sprite2D", "Control")',
        },
        include_inherited: {
          type: "boolean",
          description:
            "Include inherited properties/methods/signals from parent classes (default: false)",
        },
      },
      required: ["class_name"],
    },
  },
  {
    name: "godot_add_node",
    description:
      "Add a new node to the currently edited scene in the Godot editor. The node is added as a child of parent_path and persisted in the scene. Use this instead of writing .tscn files for simple scene modifications.",
    inputSchema: {
      type: "object",
      properties: {
        parent_path: {
          type: "string",
          description:
            'NodePath to the parent node (default: "." for scene root)',
        },
        node_name: {
          type: "string",
          description: "Name for the new node",
        },
        node_type: {
          type: "string",
          description:
            'Godot node class (e.g. "Sprite2D", "CharacterBody2D", "Label")',
        },
        properties: {
          type: "object",
          description:
            'Optional properties to set. Supports Vector2 ({"x":0,"y":0}), Color ({"r":1,"g":0,"b":0}), and resource paths ("res://...")',
        },
      },
      required: ["node_name", "node_type"],
    },
  },
  {
    name: "godot_update_node",
    description:
      "Update properties on an existing node in the currently edited scene. Use this to modify position, scale, visibility, or any other property without rewriting scene files.",
    inputSchema: {
      type: "object",
      properties: {
        node_path: {
          type: "string",
          description: "NodePath to the node to update",
        },
        properties: {
          type: "object",
          description:
            'Properties to set. Supports Vector2 ({"x":0,"y":0}), Color ({"r":1,"g":0,"b":0}), and resource paths ("res://...")',
        },
      },
      required: ["node_path", "properties"],
    },
  },
  {
    name: "godot_delete_node",
    description:
      "Remove a node from the currently edited scene in the Godot editor.",
    inputSchema: {
      type: "object",
      properties: {
        node_path: {
          type: "string",
          description: "NodePath to the node to delete",
        },
      },
      required: ["node_path"],
    },
  },
  {
    name: "godot_get_editor_screenshot",
    description:
      'Capture the Godot editor 2D or 3D viewport as a base64-encoded PNG image. Use this to visually verify the game looks correct after creating scenes or modifying nodes. Claude can "see" the result.',
    inputSchema: {
      type: "object",
      properties: {
        viewport: {
          type: "string",
          enum: ["2d", "3d"],
          description: 'Which viewport to capture (default: "2d")',
        },
      },
    },
  },
  {
    name: "godot_get_open_scripts",
    description:
      "Get the list of scripts currently open in the Godot script editor. Provides context about what the developer is working on.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------
export async function handleToolCall(name, args) {
  switch (name) {
    case "godot_get_project_state":
      return await toolGetProjectState();
    case "godot_run_scene":
      return await toolRunScene(args.scene_path || "");
    case "godot_stop_scene":
      return await toolStopScene();
    case "godot_get_errors":
      return await toolGetErrors(args.detailed !== false);
    case "godot_reload_filesystem":
      return await toolReloadFilesystem();
    case "godot_parse_scene":
      return await toolParseScene(args.scene_path);
    case "godot_generate_asset":
      return await toolGenerateAsset(args);
    case "godot_generate_asset_pack":
      return await toolGenerateAssetPack(args);
    case "godot_scan_project_files":
      return await toolScanProjectFiles(args.extensions);
    case "godot_read_project_setting":
      return await toolReadProjectSetting(args.key);
    case "godot_list_addons":
      return await toolListAddons(args.category || "");
    case "godot_install_addon":
      return await toolInstallAddon(args.addon_id, args.force === true);
    case "godot_verify_addon":
      return await toolVerifyAddon(args.addon_id);
    case "godot_apply_integration_pack":
      return await toolApplyIntegrationPack(args.pack_id, args.strict !== false);
    case "godot_score_poc_quality":
      return await toolScorePocQuality(args);
    case "godot_log":
      return await toolLog(args.message);
    case "godot_save_build_state":
      return await toolSaveBuildState(args.state);
    case "godot_get_build_state":
      return await toolGetBuildState();
    case "godot_get_latest_quality_report":
      return await toolGetLatestQualityReport(
        args.phase_number,
        args.limit
      );
    case "godot_evaluate_quality_gates":
      return await toolEvaluateQualityGates(
        args.phase_number,
        args.phase_name || "",
        args.quality_gates || {}
      );
    case "godot_update_phase":
      return await toolUpdatePhase(args.phase_number, args.phase_name, args.status, args.quality_gates || {});
    case "godot_get_scene_tree":
      return await toolGetSceneTree(args.max_depth || 10);
    case "godot_get_class_info":
      return await toolGetClassInfo(args.class_name, args.include_inherited || false);
    case "godot_add_node":
      return await toolAddNode(args.parent_path || ".", args.node_name, args.node_type, args.properties || {});
    case "godot_update_node":
      return await toolUpdateNode(args.node_path, args.properties || {});
    case "godot_delete_node":
      return await toolDeleteNode(args.node_path);
    case "godot_get_editor_screenshot":
      return await toolGetEditorScreenshot(args.viewport || "2d");
    case "godot_get_open_scripts":
      return await toolGetOpenScripts();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetProjectState() {
  await bridge.sendLog("[MCP] Getting project state...");
  const connected = await bridge.isConnected();
  const files = await scanDir(PROJECT_PATH, [
    "gd",
    "tscn",
    "tres",
    "svg",
    "png",
  ]);
  const projectSettings = await readProjectGodot();

  const result = {
    editor_connected: connected,
    project_path: resolve(PROJECT_PATH),
    project_name: projectSettings["application/config/name"] || "Unknown",
    main_scene: projectSettings["application/run/main_scene"] || "",
    files: {
      scripts: files.filter((f) => f.endsWith(".gd")),
      scenes: files.filter((f) => f.endsWith(".tscn")),
      resources: files.filter((f) => f.endsWith(".tres")),
      assets: files.filter(
        (f) =>
          f.endsWith(".svg") || f.endsWith(".png") || f.endsWith(".jpg")
      ),
    },
  };

  if (connected) {
    try {
      const status = await bridge.getStatus();
      result.editor_status = status;
    } catch {
      /* editor data unavailable */
    }
  }

  await bridge.sendLog(`[MCP] Project: ${result.project_name} — ${files.length} files, editor ${connected ? "connected" : "offline"}`);
  return result;
}

async function toolRunScene(scenePath) {
  await bridge.sendLog(`[MCP] Running ${scenePath || "main scene"}...`);
  return await bridge.runScene(scenePath);
}

async function toolStopScene() {
  await bridge.sendLog("[MCP] Stopping scene...");
  return await bridge.stopScene();
}

async function toolGetErrors(detailed = true) {
  if (detailed) {
    await bridge.sendLog("[MCP] Running detailed error check (headless validation)...");
    try {
      const result = await bridge.getDetailedErrors();
      const errCount = result.errors?.length || 0;
      const warnCount = result.warnings?.length || 0;
      await bridge.sendLog(`[MCP] Detailed check: ${errCount} errors, ${warnCount} warnings`);
      return result;
    } catch (err) {
      // If detailed check fails (timeout, etc.), fall back to fast check
      await bridge.sendLog(`[MCP] Detailed check failed (${err.message}), falling back to fast check...`);
      const result = await bridge.getErrors();
      const errCount = result.errors?.length || 0;
      const warnCount = result.warnings?.length || 0;
      await bridge.sendLog(`[MCP] Fast check: ${errCount} errors, ${warnCount} warnings`);
      return result;
    }
  } else {
    await bridge.sendLog("[MCP] Running fast error check...");
    const result = await bridge.getErrors();
    const errCount = result.errors?.length || 0;
    const warnCount = result.warnings?.length || 0;
    await bridge.sendLog(`[MCP] Errors: ${errCount}, Warnings: ${warnCount}`);
    return result;
  }
}

async function toolReloadFilesystem() {
  await bridge.sendLog("[MCP] Reloading filesystem...");
  const result = await bridge.reloadFilesystem();

  // ── Auto-check errors after every reload so the AI always knows its error state ──
  let errorCount = 0;
  let errorSummary = [];
  try {
    const errorResult = await bridge.getErrors();
    const errors = errorResult.errors || [];
    errorCount = errors.length;
    errorSummary = errors.slice(0, 5).map((e) => e.file || e.message || "unknown");
    if (errorCount > 0) {
      await bridge.sendLog(
        `[MCP] ⚠️ ${errorCount} errors detected after reload. You MUST call godot_get_errors() and fix them before writing more files.`
      );
    } else {
      await bridge.sendLog("[MCP] ✓ Reload complete — 0 errors.");
    }
  } catch {
    // Bridge may not be available for error check
  }

  return {
    ...result,
    _error_count: errorCount,
    _error_files: errorSummary,
    _action_required: errorCount > 0
      ? `STOP: ${errorCount} errors detected. Call godot_get_errors() to see details and fix them NOW before writing any more files. Do NOT continue building with errors.`
      : null,
  };
}

async function toolParseScene(scenePath) {
  await bridge.sendLog(`[MCP] Parsing scene: ${scenePath}`);
  const result = await parseScene(scenePath);
  await bridge.sendLog(`[MCP] Scene parsed: ${scenePath}`);
  return result;
}

async function toolGenerateAsset(args) {
  const fmt = args.format || "svg";
  await bridge.sendLog(
    `[MCP] Generating ${fmt} asset: ${args.name} (${args.type})`
  );
  let result;
  if (args.format === "png") {
    result = await generatePng(args);
  } else {
    result = await generatePlaceholder(args);
  }
  await bridge.sendLog(`[MCP] Asset created: ${args.name}.${fmt}`);
  return result;
}

async function toolGenerateAssetPack(args) {
  const preset = args.preset || "top_down_shooter";
  const fmt = args.format || "svg";
  const style = args.style || "sci-fi";

  await bridge.sendLog(
    `[MCP] Generating asset pack: ${preset} (${style}, ${fmt})...`
  );
  const result = await generateAssetPack(args || {});
  const generatedNames = (result.generated || [])
    .slice(0, 6)
    .map((a) => a.name)
    .join(", ");
  await bridge.sendLog(
    `[MCP] Asset pack created: ${result.total} assets${
      generatedNames ? ` (${generatedNames}${result.total > 6 ? ", ..." : ""})` : ""
    }`
  );
  return result;
}

async function toolScanProjectFiles(extensions) {
  await bridge.sendLog("[MCP] Scanning project files...");
  const exts = extensions || [
    "gd",
    "tscn",
    "tres",
    "svg",
    "png",
    "ogg",
    "wav",
  ];
  const files = await scanDir(PROJECT_PATH, exts);
  await bridge.sendLog(`[MCP] Found ${files.length} project files`);
  return {
    project_path: resolve(PROJECT_PATH),
    total: files.length,
    files,
  };
}

async function toolReadProjectSetting(key) {
  await bridge.sendLog(`[MCP] Reading setting: ${key}`);
  const settings = await readProjectGodot();
  const value = settings[key];
  if (value === undefined) {
    return { key, found: false, value: null };
  }
  return { key, found: true, value };
}

async function toolListAddons(category) {
  const catalog = await loadAddonCatalog();
  let addons = catalog.addons || [];
  if (category) {
    addons = addons.filter((addon) => addon.category === category);
  }

  await bridge.sendLog(
    `[MCP] Listing curated add-ons${category ? ` in '${category}'` : ""}: ${addons.length}`
  );

  return {
    ok: true,
    catalog_version: catalog.version || "unknown",
    total: addons.length,
    addons,
  };
}

async function toolInstallAddon(addonId, force = false) {
  const catalog = await loadAddonCatalog();
  const addon = findCatalogAddon(catalog, addonId);
  if (!addon) {
    await bridge.sendLog(`[MCP] Unknown addon_id: ${addonId}`);
    return {
      ok: false,
      addon_id: addonId,
      reason: `Unknown addon_id '${addonId}'. Call godot_list_addons first.`,
    };
  }

  if (addon.install_method !== "git_clone_subdir") {
    await bridge.sendLog(
      `[MCP] Unsupported install method '${addon.install_method}' for addon '${addon.id}'`
    );
    return {
      ok: false,
      addon_id: addon.id,
      reason: `Unsupported install method '${addon.install_method}'.`,
    };
  }

  const preVerify = await verifyCatalogAddon(addon);
  if (preVerify.passed && !force) {
    await bridge.sendLog(
      `[MCP] Add-on '${addon.id}' already installed and verified`
    );
    return {
      ok: true,
      addon_id: addon.id,
      already_installed: true,
      verification: preVerify,
    };
  }

  const targetPath = resolveProjectPath(addon.target_dir);
  const tmpRoot = resolve(
    PROJECT_PATH,
    ".claude",
    "tmp",
    `addon_${addon.id}_${Date.now()}`
  );
  const tmpCheckout = resolve(tmpRoot, "checkout");

  await bridge.sendLog(
    `[MCP] Installing add-on '${addon.id}' from ${addon.source_url}...`
  );

  try {
    await mkdir(tmpRoot, { recursive: true });
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", addon.source_url, tmpCheckout],
      {
        cwd: PROJECT_PATH,
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      }
    );

    const sourcePath = resolve(tmpCheckout, addon.source_subdir);
    if (!(await fileExists(sourcePath))) {
      throw new Error(
        `Catalog source_subdir missing after clone: ${addon.source_subdir}`
      );
    }

    if (force) {
      await rm(targetPath, { recursive: true, force: true });
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  } catch (err) {
    await bridge.sendLog(
      `[MCP] Add-on install failed for '${addon.id}': ${err.message}`
    );
    return {
      ok: false,
      addon_id: addon.id,
      install_attempted: true,
      reason: `Install failed: ${err.message}`,
      remediation: [
        `Verify network access and git availability, then retry godot_install_addon('${addon.id}').`,
        `Manual fallback: clone '${addon.source_url}' and copy '${addon.source_subdir}' to 'res://${addon.target_dir}'.`,
      ],
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }

  const verification = await verifyCatalogAddon(addon);
  if (!verification.passed) {
    await bridge.sendLog(
      `[MCP] Add-on install completed but verification failed for '${addon.id}'`
    );
    return {
      ok: false,
      addon_id: addon.id,
      install_attempted: true,
      verification,
      reason: "Install completed but required files are still missing.",
      remediation: verification.remediation,
    };
  }

  await bridge.sendLog(`[MCP] ✓ Add-on '${addon.id}' installed and verified`);
  return {
    ok: true,
    addon_id: addon.id,
    install_attempted: true,
    verification,
  };
}

async function toolVerifyAddon(addonId) {
  const catalog = await loadAddonCatalog();
  const addon = findCatalogAddon(catalog, addonId);
  if (!addon) {
    await bridge.sendLog(`[MCP] Unknown addon_id: ${addonId}`);
    return {
      ok: false,
      addon_id: addonId,
      reason: `Unknown addon_id '${addonId}'. Call godot_list_addons first.`,
    };
  }

  const verification = await verifyCatalogAddon(addon);
  await bridge.sendLog(
    `[MCP] Verification '${addon.id}': ${verification.passed ? "passed" : "failed"}`
  );
  return {
    ok: verification.passed,
    addon_id: addon.id,
    verification,
  };
}

async function toolApplyIntegrationPack(packId, strict = true) {
  const catalog = await loadAddonCatalog();
  const pack = findCatalogPack(catalog, packId);
  if (!pack) {
    await bridge.sendLog(`[MCP] Unknown integration pack: ${packId}`);
    return {
      ok: false,
      rejected: true,
      pack_id: packId,
      reason: `Unknown integration pack '${packId}'.`,
    };
  }

  await bridge.sendLog(
    `[MCP] Applying integration pack '${pack.id}' (${pack.required_addon_ids.length} required add-on(s))...`
  );

  const results = [];
  for (const addonId of pack.required_addon_ids) {
    const install = await toolInstallAddon(addonId, false);
    const verify = await toolVerifyAddon(addonId);
    results.push({
      addon_id: addonId,
      install,
      verify,
      ok: Boolean(install.ok && verify.ok),
    });
  }

  const failed = results.filter((result) => !result.ok);
  const reportPath = await persistIntegrationPackReport({
    pack_id: pack.id,
    strict_mode: strict,
    ok: failed.length === 0,
    results,
  });

  if (strict && failed.length > 0) {
    await bridge.sendLog(
      `[MCP] ⛔ Integration pack '${pack.id}' rejected — ${failed.length} required add-on(s) unhealthy`
    );
    return {
      ok: false,
      rejected: true,
      pack_id: pack.id,
      strict_mode: true,
      failed_addons: failed.map((item) => item.addon_id),
      reason:
        `INTEGRATION PACK BLOCKED: ${failed.length} required add-on(s) failed install/verification.`,
      remediation: [
        "Inspect per-addon failures in results and fix install issues first.",
        "Retry with godot_apply_integration_pack(pack_id, true) after failures are resolved.",
      ],
      report_path: reportPath,
      results,
    };
  }

  await bridge.sendLog(
    `[MCP] ✓ Integration pack '${pack.id}' applied${failed.length > 0 ? " (non-strict mode with failures)" : ""}`
  );
  return {
    ok: failed.length === 0,
    rejected: false,
    pack_id: pack.id,
    strict_mode: strict,
    failed_addons: failed.map((item) => item.addon_id),
    report_path: reportPath,
    results,
  };
}

async function toolScorePocQuality(args = {}) {
  const iterationCount = Number.isFinite(Number(args.iteration_count))
    ? Math.max(1, Number(args.iteration_count))
    : 1;
  const maxIterations = Number.isFinite(Number(args.max_iterations))
    ? Math.max(1, Number(args.max_iterations))
    : 3;
  const benchmarkId = args.benchmark_id || "poc_prompt_unknown";
  const runId = args.run_id || `${benchmarkId}-${Date.now()}`;
  const signatureMoments = Array.isArray(args.signature_moments)
    ? args.signature_moments.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  const hardGates = normalizeChecklistBooleans(
    args.hard_gates || {},
    POC_REQUIRED_HARD_GATES
  );
  const antiTutorialChecks = normalizeChecklistBooleans(
    args.anti_tutorial_visual_checks || {},
    POC_REQUIRED_VISUAL_CHECKS
  );
  const scoreInfo = normalizePocScores(args.scores || {});

  if (!scoreInfo.ok) {
    await bridge.sendLog(`[MCP] PoC scoring rejected: ${scoreInfo.reason}`);
    return {
      ok: false,
      rejected: true,
      reason: scoreInfo.reason,
    };
  }

  const weightedTotal = calculateWeightedPocScore(scoreInfo.scores);
  const hardFailures = checklistFailures(hardGates);
  const visualFailures = checklistFailures(antiTutorialChecks);
  const hardGatesPassed = hardFailures.length === 0;
  const antiTutorialPassed = visualFailures.length === 0;
  const scoreValues = Object.values(scoreInfo.scores);
  const categoryMinPass = scoreValues.every((value) => value >= 3);
  const twoCategoriesAtLeastFour =
    scoreValues.filter((value) => value >= 4).length >= 2;

  const gatesPassed =
    hardGatesPassed &&
    antiTutorialPassed &&
    weightedTotal >= 80 &&
    categoryMinPass &&
    twoCategoriesAtLeastFour &&
    scoreInfo.scores.visual_polish_cohesion >= 4;

  const veryGoodStatus =
    gatesPassed &&
    weightedTotal >= 85 &&
    scoreInfo.scores.controls_game_feel >= 4 &&
    scoreInfo.scores.progression_variety >= 4 &&
    scoreInfo.scores.visual_polish_cohesion >= 4 &&
    signatureMoments.length >= 2;

  const escalationRequired = !gatesPassed && iterationCount >= maxIterations;
  const verdict = gatesPassed
    ? "go"
    : escalationRequired
      ? "no_go"
      : "needs_iteration";

  const nextActions = derivePocNextActions({
    hardFailures,
    visualFailures,
    scores: scoreInfo.scores,
    escalationRequired,
    maxActions: 8,
  });

  const report = {
    ok: gatesPassed,
    phase_number: 6,
    phase_name: "Final QA (PoC Rubric)",
    schema_version: "poc-quality-report-v1",
    benchmark_id: benchmarkId,
    run_id: runId,
    timestamp_utc: new Date().toISOString(),
    max_iterations: maxIterations,
    iteration_count: iterationCount,
    objective_quality: {
      gates_passed: hardGatesPassed,
      failed_quality_gates: hardFailures,
      quality_report_paths: [],
    },
    hard_gates: hardGates,
    anti_tutorial_visual_checks: antiTutorialChecks,
    hard_gate_failures: hardFailures,
    anti_tutorial_failures: visualFailures,
    scores: scoreInfo.scores,
    weighted_total_score: weightedTotal,
    category_min_pass: categoryMinPass,
    two_categories_at_least_four: twoCategoriesAtLeastFour,
    signature_moments: signatureMoments,
    very_good_status: veryGoodStatus,
    verdict,
    escalation_required: escalationRequired,
    gates_passed: gatesPassed,
    next_actions: nextActions,
    notes: typeof args.notes === "string" ? args.notes : "",
  };

  const qualityReportPath = await persistQualityReport(report, "poc_rubric_score", {
    benchmark_id: benchmarkId,
    run_id: runId,
    iteration_count: iterationCount,
    max_iterations: maxIterations,
  });
  if (qualityReportPath) {
    report.quality_report_path = qualityReportPath;
    report.objective_quality.quality_report_paths.push(qualityReportPath);
    await bridge.sendLog(`[MCP] PoC quality report saved: ${qualityReportPath}`);
  }

  await bridge.sendLog(
    `[MCP] PoC quality verdict=${verdict} score=${weightedTotal} iteration=${iterationCount}/${maxIterations}`
  );
  return report;
}

async function toolLog(message) {
  await bridge.sendLog(message);
  return { ok: true, message };
}

async function toolSaveBuildState(state) {
  const dir = resolve(PROJECT_PATH, ".claude");
  const filePath = resolve(dir, "build_state.json");
  await bridge.sendLog("[MCP] Saving build checkpoint...");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
    await bridge.sendLog("[MCP] Build checkpoint saved");
    return { ok: true, path: filePath };
  } catch (err) {
    await bridge.sendLog(`[MCP] Failed to save checkpoint: ${err.message}`);
    throw new Error(`Failed to save build state: ${err.message}`);
  }
}

async function toolGetBuildState() {
  const filePath = resolve(PROJECT_PATH, ".claude", "build_state.json");
  await bridge.sendLog("[MCP] Checking for build checkpoint...");
  try {
    const content = await readFile(filePath, "utf-8");
    const state = JSON.parse(content);
    await bridge.sendLog(`[MCP] Found checkpoint: ${state.game_name || "unknown"} — Phase ${state.current_phase?.number ?? "?"}`);
    return { found: true, state };
  } catch (err) {
    if (err.code === "ENOENT") {
      await bridge.sendLog("[MCP] No build checkpoint found");
      return { found: false, state: null };
    }
    await bridge.sendLog(`[MCP] Checkpoint file corrupted: ${err.message}`);
    return { found: false, state: null, error: err.message };
  }
}

async function toolGetLatestQualityReport(phaseNumber, limit) {
  const maxReports = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(10, Number(limit)))
    : 1;
  const phaseFilter = Number.isFinite(Number(phaseNumber))
    ? Number(phaseNumber)
    : null;

  await bridge.sendLog(
    `[MCP] Reading quality reports${phaseFilter === null ? "" : ` for Phase ${phaseFilter}`}...`
  );

  const reportPaths = await listQualityReportPaths();
  const filtered = reportPaths.filter((reportPath) => {
    if (phaseFilter === null) return true;
    return extractPhaseNumberFromReportPath(reportPath) === phaseFilter;
  });

  if (filtered.length === 0) {
    await bridge.sendLog("[MCP] No matching quality reports found");
    return {
      found: false,
      total: 0,
      reports: [],
      phase_number: phaseFilter,
    };
  }

  const selected = filtered.slice(0, maxReports);
  const reports = [];
  for (const reportPath of selected) {
    try {
      const absPath = reportPathToAbsolute(reportPath);
      const content = await readFile(absPath, "utf-8");
      reports.push({
        path: reportPath,
        data: JSON.parse(content),
      });
    } catch (err) {
      reports.push({
        path: reportPath,
        error: `Failed to read report: ${err.message}`,
      });
    }
  }

  await bridge.sendLog(
    `[MCP] Loaded ${reports.length} quality report${reports.length === 1 ? "" : "s"}`
  );

  return {
    found: true,
    total: filtered.length,
    returned: reports.length,
    phase_number: phaseFilter,
    reports,
  };
}

async function toolEvaluateQualityGates(phaseNumber, phaseName = "", qualityGates = {}) {
  await bridge.sendLog(
    `[MCP] Evaluating objective quality gates for Phase ${phaseNumber}${phaseName ? ` (${phaseName})` : ""}...`
  );

  const evaluation = await evaluatePhaseQualityGates(
    phaseNumber,
    phaseName,
    qualityGates
  );
  const qualityReportPath = await persistQualityReport(
    evaluation,
    "manual_evaluation",
    { phase_name: phaseName || evaluation.phase_name }
  );
  if (qualityReportPath) {
    evaluation.quality_report_path = qualityReportPath;
    await bridge.sendLog(`[MCP] Quality report saved: ${qualityReportPath}`);
  }

  const failedCount = evaluation.failed_quality_gates.length;
  if (failedCount > 0) {
    await bridge.sendLog(
      `[MCP] ⚠️ Quality gates failed: ${failedCount} gate(s). ` +
      `Use failed_quality_gates + gate_details to fix before completion.`
    );
  } else {
    await bridge.sendLog(
      `[MCP] ✓ Quality gates passed for Phase ${phaseNumber}.`
    );
  }

  return evaluation;
}

async function toolUpdatePhase(phaseNumber, phaseName, status, qualityGates) {
  let mergedQualityGates = qualityGates || {};
  let qualityReportPath = "";

  // ── HARD GATE: reject phase completion if errors exist ──
  if (status === "completed") {
    await bridge.sendLog(`[MCP] Phase ${phaseNumber}: ${phaseName} — validating before completion...`);
    let errorCount = 0;
    let errorFiles = [];
    try {
      const errorResult = await bridge.getErrors();
      const errors = errorResult.errors || [];
      errorCount = errors.length;
      errorFiles = errors.slice(0, 10).map((e) => e.file || e.message || "unknown");
    } catch {
      // If we can't check errors (bridge down), allow completion
    }

    if (errorCount > 0) {
      await bridge.sendLog(
        `[MCP] ⛔ PHASE COMPLETION REJECTED — ${errorCount} errors exist. Fix ALL errors before completing Phase ${phaseNumber}.`
      );
      // Keep phase as in_progress so the dock shows it's still being worked on
      try {
        await bridge.updatePhase(phaseNumber, phaseName, "in_progress", mergedQualityGates);
      } catch { /* best-effort */ }
      return {
        ok: false,
        rejected: true,
        phase_number: phaseNumber,
        phase_name: phaseName,
        requested_status: "completed",
        actual_status: "in_progress",
        error_count: errorCount,
        error_files: errorFiles,
        reason:
          `PHASE COMPLETION BLOCKED: ${errorCount} compilation errors found. ` +
          `You MUST call godot_get_errors() to see the full error details, fix every error, ` +
          `then call godot_update_phase(${phaseNumber}, "${phaseName}", "completed") again. ` +
          `The phase remains "in_progress" until zero errors.`,
      };
    }

    // ── HARD GATE: objective quality gate evaluation for late phases ──
    if (phaseNumber >= 5) {
      const qualityEval = await evaluatePhaseQualityGates(
        phaseNumber,
        phaseName,
        mergedQualityGates
      );
      qualityReportPath = await persistQualityReport(
        qualityEval,
        "phase_completion_check",
        {
          phase_name: phaseName || qualityEval.phase_name,
          requested_status: status,
        }
      );
      if (qualityReportPath) {
        await bridge.sendLog(`[MCP] Quality report saved: ${qualityReportPath}`);
      }
      mergedQualityGates = qualityEval.merged_quality_gates;

      if (!qualityEval.gates_passed) {
        await bridge.sendLog(
          `[MCP] ⛔ PHASE COMPLETION REJECTED — ${qualityEval.failed_quality_gates.length} quality gates failed.`
        );
        try {
          await bridge.updatePhase(
            phaseNumber,
            phaseName,
            "in_progress",
            mergedQualityGates
          );
        } catch {
          /* best-effort */
        }
        return {
          ok: false,
          rejected: true,
          phase_number: phaseNumber,
          phase_name: phaseName,
          requested_status: "completed",
          actual_status: "in_progress",
          reason:
            `PHASE COMPLETION BLOCKED: ${qualityEval.failed_quality_gates.length} objective quality gates failed. ` +
            `Call godot_evaluate_quality_gates(${phaseNumber}) to inspect gate_details, fix the failed items, then retry completion.`,
          failed_quality_gates: qualityEval.failed_quality_gates,
          gate_details: qualityEval.gate_details,
          quality_metrics: qualityEval.quality_metrics,
          quality_report_path: qualityReportPath,
        };
      }
    }

    await bridge.sendLog(`[MCP] ✓ Phase ${phaseNumber} validation passed — 0 errors. Marking completed.`);
  }

  await bridge.sendLog(`[MCP] Phase ${phaseNumber}: ${phaseName} — ${status}`);
  try {
    await bridge.updatePhase(phaseNumber, phaseName, status, mergedQualityGates);
  } catch {
    // Phase updates are best-effort — don't fail if Godot isn't running
  }
  return {
    ok: true,
    phase_number: phaseNumber,
    phase_name: phaseName,
    status,
    quality_gates: mergedQualityGates,
    quality_report_path: qualityReportPath,
  };
}

// ---------------------------------------------------------------------------
// Editor Integration Tools
// ---------------------------------------------------------------------------

async function toolGetSceneTree(maxDepth) {
  await bridge.sendLog("[MCP] Getting scene tree...");
  const result = await bridge.getSceneTree(maxDepth);
  const nodeCount = countNodes(result);
  await bridge.sendLog(`[MCP] Scene tree: ${nodeCount} nodes`);
  return result;
}

function countNodes(node) {
  if (!node || node.error) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

async function toolGetClassInfo(className, includeInherited) {
  await bridge.sendLog(`[MCP] Looking up class: ${className}`);
  const result = await bridge.getClassInfo(className, includeInherited);
  if (result.error) {
    await bridge.sendLog(`[MCP] Class not found: ${className}`);
  } else {
    const pCount = result.properties?.length || 0;
    const mCount = result.methods?.length || 0;
    const sCount = result.signals?.length || 0;
    await bridge.sendLog(`[MCP] ${className}: ${pCount} props, ${mCount} methods, ${sCount} signals`);
  }
  return result;
}

async function toolAddNode(parentPath, nodeName, nodeType, properties) {
  await bridge.sendLog(`[MCP] Adding node: ${nodeName} (${nodeType}) under ${parentPath}`);
  const result = await bridge.addNode(parentPath, nodeName, nodeType, properties);
  if (result.success) {
    await bridge.sendLog(`[MCP] Node added: ${result.path}`);
  } else {
    await bridge.sendLog(`[MCP] Failed to add node: ${result.error || "unknown error"}`);
  }
  return result;
}

async function toolUpdateNode(nodePath, properties) {
  const propNames = Object.keys(properties).join(", ");
  await bridge.sendLog(`[MCP] Updating node ${nodePath}: ${propNames}`);
  const result = await bridge.updateNode(nodePath, properties);
  if (result.success) {
    await bridge.sendLog(`[MCP] Node updated: ${nodePath}`);
  } else {
    await bridge.sendLog(`[MCP] Failed to update node: ${result.error || "unknown error"}`);
  }
  return result;
}

async function toolDeleteNode(nodePath) {
  await bridge.sendLog(`[MCP] Deleting node: ${nodePath}`);
  const result = await bridge.deleteNode(nodePath);
  if (result.success) {
    await bridge.sendLog(`[MCP] Node deleted: ${nodePath}`);
  } else {
    await bridge.sendLog(`[MCP] Failed to delete node: ${result.error || "unknown error"}`);
  }
  return result;
}

async function toolGetEditorScreenshot(viewport) {
  await bridge.sendLog(`[MCP] Capturing ${viewport} viewport screenshot...`);
  const result = await bridge.getEditorScreenshot(viewport);
  if (result.image) {
    await bridge.sendLog(`[MCP] Screenshot captured: ${result.width}x${result.height}`);
  } else {
    await bridge.sendLog(`[MCP] Screenshot failed: ${result.error || "unknown error"}`);
  }
  return result;
}

async function toolGetOpenScripts() {
  await bridge.sendLog("[MCP] Getting open scripts...");
  const result = await bridge.getOpenScripts();
  const count = result.scripts?.length || 0;
  await bridge.sendLog(`[MCP] ${count} scripts open in editor`);
  return result;
}

// ---------------------------------------------------------------------------
// Exported helpers (used by index.js)
// ---------------------------------------------------------------------------

/**
 * Quick error count check via the bridge (fast — uses cached validation).
 * Returns 0 if bridge is unavailable.
 */
export async function getErrorCount() {
  const result = await bridge.getErrors();
  return result.errors?.length || 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function scanDir(dir, extensions, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden dirs, .godot cache, addons
      if (
        entry.name.startsWith(".") ||
        entry.name === "addons" ||
        entry.name === ".godot"
      )
        continue;
      await scanDir(full, extensions, results);
    } else {
      const ext = extname(entry.name).slice(1);
      if (extensions.includes(ext)) {
        results.push("res://" + relative(PROJECT_PATH, full));
      }
    }
  }

  return results;
}

async function readProjectGodot() {
  const path = resolve(PROJECT_PATH, "project.godot");
  let content;
  try {
    content = await readFile(path, "utf-8");
  } catch {
    return {};
  }

  const settings = {};
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;

    const sectionMatch = trimmed.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    const kvMatch = trimmed.match(/^(\w[\w/]*)=(.+)$/);
    if (kvMatch) {
      const fullKey = currentSection
        ? `${currentSection}/${kvMatch[1]}`
        : kvMatch[1];
      let value = kvMatch[2].trim();
      // Strip quotes
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);
      settings[fullKey] = value;
    }
  }

  return settings;
}

async function loadAddonCatalog() {
  if (addonCatalogCache) return addonCatalogCache;

  const content = await readFile(ADDON_CATALOG_PATH, "utf-8");
  const parsed = JSON.parse(content);

  if (!parsed || !Array.isArray(parsed.addons) || !Array.isArray(parsed.integration_packs)) {
    throw new Error("Invalid add-on catalog format");
  }

  addonCatalogCache = parsed;
  return addonCatalogCache;
}

function findCatalogAddon(catalog, addonId) {
  if (!catalog || !Array.isArray(catalog.addons)) return null;
  return catalog.addons.find((addon) => addon.id === addonId) || null;
}

function findCatalogPack(catalog, packId) {
  if (!catalog || !Array.isArray(catalog.integration_packs)) return null;
  return catalog.integration_packs.find((pack) => pack.id === packId) || null;
}

async function verifyCatalogAddon(addon) {
  const requiredFiles = addon?.verification?.required_files || [];
  const presentFiles = [];
  const missingFiles = [];

  for (const relPath of requiredFiles) {
    const absPath = resolveProjectPath(relPath);
    if (await fileExists(absPath)) {
      presentFiles.push(`res://${relPath}`);
    } else {
      missingFiles.push(`res://${relPath}`);
    }
  }

  const settings = await readProjectGodot();
  const enabledRaw = settings["editor_plugins/enabled"] || "";
  const pluginCfgResPath = `res://${addon.target_dir}/plugin.cfg`;
  const plugin_listed_in_project_settings =
    typeof enabledRaw === "string" && enabledRaw.includes(pluginCfgResPath);
  const passed = missingFiles.length === 0;

  return {
    passed,
    required_files: requiredFiles.map((relPath) => `res://${relPath}`),
    present_files: presentFiles,
    missing_files: missingFiles,
    plugin_listed_in_project_settings,
    remediation: passed
      ? []
      : [
          `Re-run godot_install_addon('${addon.id}') or install manually from ${addon.source_url}.`,
          `Ensure required files exist under res://${addon.target_dir}.`,
        ],
  };
}

function resolveProjectPath(pathLike) {
  const clean = String(pathLike || "")
    .replace(/^res:\/\//, "")
    .replace(/^\/+/, "");
  const abs = resolve(PROJECT_PATH, clean);
  const projectRoot = resolve(PROJECT_PATH);
  const relToRoot = relative(projectRoot, abs);
  if (relToRoot.startsWith("..") || relToRoot === "") {
    throw new Error(`Path escapes project root: ${pathLike}`);
  }
  return abs;
}

function normalizeChecklistBooleans(source, requiredKeys) {
  const normalized = {};
  for (const key of requiredKeys) {
    normalized[key] = Boolean(source[key]);
  }
  return normalized;
}

function checklistFailures(checklist) {
  return Object.entries(checklist)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
}

function normalizePocScores(source) {
  const normalized = {};
  for (const [key] of Object.entries(POC_SCORE_WEIGHTS)) {
    const raw = source[key];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { ok: false, reason: `Missing numeric score for '${key}'` };
    }
    if (value < 1 || value > 5) {
      return { ok: false, reason: `Score '${key}' must be between 1 and 5` };
    }
    normalized[key] = value;
  }
  return { ok: true, scores: normalized };
}

function calculateWeightedPocScore(scores) {
  const total = Object.entries(POC_SCORE_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (Number(scores[key]) / 5) * weight,
    0
  );
  return Number(total.toFixed(1));
}

function derivePocNextActions({
  hardFailures,
  visualFailures,
  scores,
  escalationRequired,
  maxActions = 8,
}) {
  const actions = [];
  const hardHints = {
    zero_script_errors: "Fix all remaining script errors before attempting completion.",
    no_critical_warnings: "Resolve critical warnings that impact runtime correctness.",
    play_loop_complete: "Wire complete flow: menu -> gameplay -> win/lose -> restart/menu.",
    controls_clear: "Improve control responsiveness and add in-game control guidance.",
    no_soft_lock: "Remove dead-end states and verify at least 10 minutes of continuous play.",
    quality_gates_passed: "Re-run objective quality gates and fix every failed gate hint.",
  };
  const visualHints = {
    named_art_direction: "Define and apply one explicit art direction pillar across scenes and UI.",
    palette_discipline: "Constrain palette and use accent colors intentionally.",
    silhouette_readability: "Improve player/enemy/hazard silhouettes for fast gameplay readability.",
    layering_depth: "Add stronger background/midground/foreground layering and depth cues.",
    feedback_clarity: "Add distinct visual feedback for hit/death/pickup/ability events.",
    ui_theme_consistency: "Style HUD/menu to match gameplay art direction.",
    no_raw_placeholder_feel: "Replace or stylize placeholder visuals and default-looking UI elements.",
  };

  for (const failure of hardFailures) {
    actions.push(hardHints[failure] || `Fix hard gate: ${failure}`);
  }

  for (const failure of visualFailures) {
    actions.push(visualHints[failure] || `Fix visual gate: ${failure}`);
  }

  const weakestCategories = Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2);
  for (const [category] of weakestCategories) {
    actions.push(`Improve rubric category: ${category}`);
  }

  if (escalationRequired) {
    actions.push("Max quality iterations reached. Escalate for user direction before further loops.");
  }

  return Array.from(new Set(actions)).slice(0, maxActions);
}

async function evaluatePhaseQualityGates(
  phaseNumber,
  phaseName = "",
  reportedQualityGates = {}
) {
  const phase = Number.isFinite(Number(phaseNumber))
    ? Number(phaseNumber)
    : 0;
  const safeReportedQualityGates =
    reportedQualityGates && typeof reportedQualityGates === "object"
      ? reportedQualityGates
      : {};

  const signals = await collectQualitySignals();
  const gateDetails = {};
  const computedQualityGates = {};

  const addGate = (name, passed, expected, actual, hint) => {
    gateDetails[name] = {
      passed: Boolean(passed),
      expected,
      actual,
      hint,
    };
    computedQualityGates[name] = Boolean(passed);
  };

  if (phase >= 5) {
    addGate(
      "auto_visual_assets_coverage",
      signals.image_asset_count >= 6,
      ">= 6 image assets used for gameplay/UI",
      signals.image_asset_count,
      "Generate or import more coherent assets (godot_generate_asset_pack + targeted assets)."
    );

    addGate(
      "auto_ui_styling_signals",
      signals.ui_style_hits.length >= 2,
      ">= 2 UI styling markers",
      {
        count: signals.ui_style_hits.length,
        hits: signals.ui_style_hits,
      },
      "Style menus/HUD with theme overrides, StyleBoxFlat, or custom theme APIs."
    );

    addGate(
      "auto_polish_fx_signals",
      signals.polish_fx_hits.length >= 3,
      ">= 3 polish/FX markers",
      {
        count: signals.polish_fx_hits.length,
        hits: signals.polish_fx_hits,
      },
      "Add screen shake, particles, shaders, tweens, trails, or hit/death FX."
    );

    addGate(
      "auto_visual_depth_layering",
      signals.depth_layer_hits.length >= 2,
      ">= 2 depth/layering markers",
      {
        count: signals.depth_layer_hits.length,
        hits: signals.depth_layer_hits,
      },
      "Add layered background/foreground composition (e.g. parallax, vignette, gradient layers)."
    );

    addGate(
      "auto_feedback_event_coverage",
      signals.feedback_category_count >= 3,
      ">= 3 feedback event categories",
      {
        count: signals.feedback_category_count,
        categories: signals.feedback_categories,
      },
      "Ensure hit/damage, death, pickup/score, and ability events have explicit feedback hooks."
    );
  }

  if (phase >= 6) {
    addGate(
      "auto_main_scene_configured",
      signals.main_scene_exists,
      "project.godot has a valid existing main scene",
      {
        main_scene: signals.main_scene,
        resolved_main_scene_path: signals.resolved_main_scene_path,
        exists: signals.main_scene_exists,
      },
      "Set application/run/main_scene to a valid .tscn path."
    );

    addGate(
      "auto_flow_state_signals",
      signals.flow_category_count >= 3,
      ">= 3 flow state categories (menu, game_over, retry/restart, pause)",
      {
        count: signals.flow_category_count,
        categories: signals.flow_categories,
      },
      "Wire complete menu → play → game over → retry/menu flow with explicit handlers."
    );

    addGate(
      "auto_scene_coverage",
      signals.scene_count >= 2,
      ">= 2 scenes (gameplay + menu/flow scene)",
      signals.scene_count,
      "Add dedicated flow scenes (menu/gameplay/game-over) instead of a single monolithic scene."
    );

    addGate(
      "auto_no_stub_pass_methods",
      signals.pass_stub_count === 0,
      "0 function stubs that immediately use 'pass'",
      signals.pass_stub_count,
      "Replace pass stubs with real implementation or explicit temporary behavior."
    );
  }

  const mergedQualityGates = {
    ...safeReportedQualityGates,
    ...computedQualityGates,
  };
  const failedQualityGates = Object.entries(gateDetails)
    .filter(([, detail]) => !detail.passed)
    .map(([name]) => name);
  const gatesPassed = failedQualityGates.length === 0;

  return {
    ok: gatesPassed,
    phase_number: phase,
    phase_name: phaseName || phaseNameForNumber(phase),
    gates_passed: gatesPassed,
    failed_quality_gates: failedQualityGates,
    computed_quality_gates: computedQualityGates,
    merged_quality_gates: mergedQualityGates,
    gate_details: gateDetails,
    quality_metrics: {
      script_count: signals.script_count,
      scene_count: signals.scene_count,
      image_asset_count: signals.image_asset_count,
      audio_asset_count: signals.audio_asset_count,
      main_scene: signals.main_scene,
      resolved_main_scene_path: signals.resolved_main_scene_path,
      main_scene_exists: signals.main_scene_exists,
      ui_style_hits: signals.ui_style_hits.length,
      polish_fx_hits: signals.polish_fx_hits.length,
      depth_layer_hits: signals.depth_layer_hits.length,
      feedback_category_count: signals.feedback_category_count,
      flow_category_count: signals.flow_category_count,
      pass_stub_count: signals.pass_stub_count,
    },
  };
}

async function collectQualitySignals() {
  const files = await scanDir(PROJECT_PATH, [
    "gd",
    "tscn",
    "tres",
    "svg",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "ogg",
    "wav",
  ]);
  const settings = await readProjectGodot();

  const scripts = files.filter((f) => f.endsWith(".gd"));
  const scenes = files.filter((f) => f.endsWith(".tscn"));
  const imageAssets = files.filter(
    (f) =>
      f.endsWith(".svg") ||
      f.endsWith(".png") ||
      f.endsWith(".jpg") ||
      f.endsWith(".jpeg") ||
      f.endsWith(".webp")
  );
  const audioAssets = files.filter(
    (f) => f.endsWith(".ogg") || f.endsWith(".wav")
  );

  const [scriptContents, sceneContents] = await Promise.all([
    readResTextFiles(scripts),
    readResTextFiles(scenes),
  ]);

  const scriptText = scriptContents.join("\n").toLowerCase();
  const sceneText = sceneContents.join("\n").toLowerCase();
  const combinedText = `${scriptText}\n${sceneText}`;

  const uiStyleHits = findKeywordHits(combinedText, [
    "styleboxflat",
    "theme_override_styles",
    "theme_override_colors",
    "theme_override_font_sizes",
    "add_theme_stylebox_override",
    "add_theme_color_override",
    "add_theme_font_size_override",
    "theme =",
    "theme_type_variation",
  ]);

  const polishFxHits = findKeywordHits(combinedText, [
    "gpuparticles2d",
    "cpuparticles2d",
    "shadermaterial",
    "shader",
    "create_tween",
    "tween",
    "screen_shake",
    "hit_flash",
    "dissolve",
    "vignette",
    "trail",
    "animationplayer",
  ]);

  const depthLayerHits = findKeywordHits(combinedText, [
    "parallaxbackground",
    "parallax2d",
    "canvaslayer",
    "midground",
    "foreground",
    "vignette",
    "gradient",
    "background",
  ]);

  const feedbackCategories = findCategoryHits(combinedText, {
    damage: ["take_damage", "damage", "hurt", "hit_flash", "on_hit"],
    death: ["die", "death", "explode", "dissolve", "destroyed"],
    pickup_score: ["pickup", "collect", "score", "combo", "pop_score"],
    ability: ["shoot", "dash", "jump", "ability", "cast", "fire"],
  });

  const flowCategories = findCategoryHits(combinedText, {
    menu: ["main_menu", "mainmenu", "menu"],
    game_over: ["game_over", "gameover", "defeat", "you lose"],
    restart_retry: ["restart", "retry", "new_game"],
    pause: ["pause", "paused", "get_tree().paused", "esc"],
  });

  const mainScene = settings["application/run/main_scene"] || "";
  const resolvedMainScenePath = await resolveMainScenePath(mainScene, scenes);
  const mainSceneExists = !!resolvedMainScenePath;

  return {
    script_count: scripts.length,
    scene_count: scenes.length,
    image_asset_count: imageAssets.length,
    audio_asset_count: audioAssets.length,
    main_scene: mainScene,
    resolved_main_scene_path: resolvedMainScenePath,
    main_scene_exists: mainSceneExists,
    ui_style_hits: uiStyleHits,
    polish_fx_hits: polishFxHits,
    depth_layer_hits: depthLayerHits,
    feedback_categories: Object.keys(feedbackCategories),
    feedback_category_count: Object.keys(feedbackCategories).length,
    flow_categories: Object.keys(flowCategories),
    flow_category_count: Object.keys(flowCategories).length,
    pass_stub_count: scriptContents.reduce(
      (sum, content) => sum + countPassStubs(content),
      0
    ),
  };
}

async function readResTextFiles(resPaths) {
  const contents = [];
  for (const resPath of resPaths) {
    try {
      const absPath = resToAbsolute(resPath);
      const text = await readFile(absPath, "utf-8");
      contents.push(text);
    } catch {
      // Ignore unreadable files; quality checks are best-effort.
    }
  }
  return contents;
}

function findKeywordHits(text, keywords) {
  const hits = [];
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      hits.push(keyword);
    }
  }
  return hits;
}

function findCategoryHits(text, categories) {
  const hitCategories = {};
  for (const [category, patterns] of Object.entries(categories)) {
    if (patterns.some((pattern) => text.includes(pattern.toLowerCase()))) {
      hitCategories[category] = true;
    }
  }
  return hitCategories;
}

function countPassStubs(content) {
  const lines = content.split("\n");
  let count = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*func\s+/.test(lines[i])) continue;

    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#")) continue;
      if (/^func\s+/.test(next)) break;
      if (/^pass(\s+#.*)?$/.test(next)) count += 1;
      break;
    }
  }

  return count;
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveMainScenePath(mainScene, scenePaths) {
  if (!mainScene) return "";

  if (mainScene.startsWith("res://")) {
    return (await fileExists(resToAbsolute(mainScene))) ? mainScene : "";
  }

  if (mainScene.startsWith("uid://")) {
    for (const scenePath of scenePaths) {
      try {
        const content = await readFile(resToAbsolute(scenePath), "utf-8");
        if (content.includes(`uid="${mainScene}"`)) {
          return scenePath;
        }
      } catch {
        // Ignore unreadable scene files.
      }
    }
    return "";
  }

  const absolutePath = resolve(PROJECT_PATH, mainScene);
  return (await fileExists(absolutePath)) ? mainScene : "";
}

function phaseNameForNumber(num) {
  switch (num) {
    case 0:
      return "Discovery & PRD";
    case 1:
      return "Foundation";
    case 2:
      return "Player Abilities";
    case 3:
      return "Enemies & Challenges";
    case 4:
      return "UI & Game Flow";
    case 5:
      return "Polish & Game Feel";
    case 6:
      return "Final QA";
    default:
      return `Phase ${num}`;
  }
}

async function persistQualityReport(report, trigger, meta = {}) {
  const timestampIso = new Date().toISOString();
  const timestampSlug = timestampIso.replace(/[:.]/g, "-");
  const phaseNumber = Number.isFinite(Number(report?.phase_number))
    ? Number(report.phase_number)
    : "x";
  const fileName = `${timestampSlug}-phase${phaseNumber}-${trigger}.json`;
  const filePath = resolve(QUALITY_REPORTS_DIR, fileName);
  const payload = {
    version: "1.0",
    generated_at: timestampIso,
    trigger,
    meta,
    report,
  };

  try {
    await mkdir(QUALITY_REPORTS_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return `res://.claude/quality_reports/${fileName}`;
  } catch {
    return "";
  }
}

async function persistIntegrationPackReport(report) {
  const timestampIso = new Date().toISOString();
  const timestampSlug = timestampIso.replace(/[:.]/g, "-");
  const packId = report?.pack_id || "unknown_pack";
  const fileName = `${timestampSlug}-${packId}.json`;
  const filePath = resolve(INTEGRATION_PACK_REPORTS_DIR, fileName);
  const payload = {
    version: "1.0",
    generated_at: timestampIso,
    report,
  };

  try {
    await mkdir(INTEGRATION_PACK_REPORTS_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return `res://.claude/integration_packs/${fileName}`;
  } catch {
    return "";
  }
}

async function listQualityReportPaths() {
  let entries;
  try {
    entries = await readdir(QUALITY_REPORTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  return files.map((name) => `res://.claude/quality_reports/${name}`);
}

function reportPathToAbsolute(reportPath) {
  if (reportPath.startsWith("res://")) {
    return resToAbsolute(reportPath);
  }
  return resolve(PROJECT_PATH, reportPath);
}

function extractPhaseNumberFromReportPath(reportPath) {
  const match = reportPath.match(/-phase(\d+)-/);
  if (!match) return null;
  return Number(match[1]);
}
