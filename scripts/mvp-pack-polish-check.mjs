#!/usr/bin/env node
import { resolve } from "path";

function printHelp() {
  console.log(
    [
      "Usage: node scripts/mvp-pack-polish-check.mjs [options]",
      "",
      "Run MVP first add-on gate check for pack_polish and print GO/NO_GO.",
      "",
      "Options:",
      "  --project <path>   Godot project path (default: GODOT_PROJECT_PATH or cwd)",
      "  --json             Print JSON output",
      "  -h, --help         Show help",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const opts = {
    project: process.env.GODOT_PROJECT_PATH || process.cwd(),
    asJson: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") {
      opts.project = argv[i + 1] || opts.project;
      i += 1;
      continue;
    }
    if (arg === "--json") {
      opts.asJson = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return opts;
}

function toCounts(result) {
  const errors = Array.isArray(result?.errors) ? result.errors.length : 0;
  const warnings = Array.isArray(result?.warnings) ? result.warnings.length : 0;
  return { errors, warnings };
}

function summarizePack(packResult) {
  return {
    ok: Boolean(packResult?.ok),
    rejected: Boolean(packResult?.rejected),
    failed_addons: Array.isArray(packResult?.failed_addons)
      ? packResult.failed_addons
      : [],
    report_path: packResult?.report_path || null,
  };
}

function finalVerdict({ pack, verify, postErrors }) {
  const zeroErrors = postErrors.errors === 0;
  const zeroWarnings = postErrors.warnings === 0;
  const addonHealthy = pack.ok && verify.ok && !pack.rejected;
  const verdict = addonHealthy && zeroErrors && zeroWarnings ? "GO" : "NO_GO";
  return {
    verdict,
    checks: {
      addon_pack_ok: addonHealthy,
      zero_errors: zeroErrors,
      zero_warnings: zeroWarnings,
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const projectPath = resolve(opts.project);
  process.env.GODOT_PROJECT_PATH = projectPath;

  const { handleToolCall } = await import("../mcp-server/src/tools.js");

  const preErrorRaw = await handleToolCall("godot_get_errors", { detailed: false });
  const preErrors = toCounts(preErrorRaw);

  const packRaw = await handleToolCall("godot_apply_integration_pack", {
    pack_id: "pack_polish",
    strict: true,
  });
  const pack = summarizePack(packRaw);

  const verifyRaw = await handleToolCall("godot_verify_addon", {
    addon_id: "phantom_camera",
  });
  const verify = {
    ok: Boolean(verifyRaw?.ok),
    missing_files: Array.isArray(verifyRaw?.missing_files)
      ? verifyRaw.missing_files
      : [],
  };

  await handleToolCall("godot_reload_filesystem", {});
  const postErrorRaw = await handleToolCall("godot_get_errors", { detailed: true });
  const postErrors = toCounts(postErrorRaw);

  const verdictInfo = finalVerdict({ pack, verify, postErrors });
  const output = {
    checked_at_utc: new Date().toISOString(),
    project_path: projectPath,
    integration_pack: "pack_polish",
    pre_errors: preErrors,
    pack,
    verify,
    post_errors: postErrors,
    verdict: verdictInfo.verdict,
    checks: verdictInfo.checks,
  };

  if (opts.asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("MVP First Add-on Check");
    console.log(`Project: ${output.project_path}`);
    console.log(`Pack: ${output.integration_pack}`);
    console.log(
      `Pre-check errors/warnings: ${preErrors.errors}/${preErrors.warnings}`
    );
    console.log(
      `Pack applied: ${pack.ok} rejected=${pack.rejected} failed_addons=${pack.failed_addons.join(",") || "none"}`
    );
    console.log(
      `Addon verify: ${verify.ok} missing_files=${verify.missing_files.join(",") || "none"}`
    );
    console.log(
      `Post-check errors/warnings: ${postErrors.errors}/${postErrors.warnings}`
    );
    console.log(`Verdict: ${output.verdict}`);
  }

  process.exit(output.verdict === "GO" ? 0 : 1);
}

main().catch((err) => {
  console.error(`mvp-pack-polish-check failed: ${err.message}`);
  process.exit(2);
});
