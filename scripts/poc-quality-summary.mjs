#!/usr/bin/env node
import { readdir, readFile } from "fs/promises";
import { resolve } from "path";

const REQUIRED_BENCHMARKS = [
  "poc_prompt_01",
  "poc_prompt_02",
  "poc_prompt_03",
];

function parseArgs(argv) {
  const opts = {
    reportsDir: ".claude/quality_reports",
    asJson: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.asJson = true;
      continue;
    }
    if (arg === "--dir") {
      opts.reportsDir = argv[i + 1] || opts.reportsDir;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/poc-quality-summary.mjs [--dir <reports_dir>] [--json]",
      "",
      "Reads PoC rubric reports from .claude/quality_reports and prints",
      "latest verdicts per benchmark plus GO/NO-GO summary.",
    ].join("\n")
  );
}

function safeDate(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickLatestByBenchmark(reports) {
  const latest = new Map();
  for (const report of reports) {
    const key = report.benchmark_id || "unknown";
    const existing = latest.get(key);
    if (!existing) {
      latest.set(key, report);
      continue;
    }
    const currentDate =
      safeDate(report.timestamp_utc) || safeDate(report.generated_at);
    const existingDate =
      safeDate(existing.timestamp_utc) || safeDate(existing.generated_at);
    if (!existingDate || (currentDate && currentDate > existingDate)) {
      latest.set(key, report);
    }
  }
  return latest;
}

function evaluateDecision(latestByBenchmark) {
  const requiredResults = REQUIRED_BENCHMARKS.map((benchmarkId) => ({
    benchmark_id: benchmarkId,
    report: latestByBenchmark.get(benchmarkId) || null,
  }));

  const missing = requiredResults
    .filter((item) => !item.report)
    .map((item) => item.benchmark_id);
  const goCount = requiredResults.filter(
    (item) => item.report?.verdict === "go"
  ).length;

  let decision = "NO_GO";
  if (missing.length > 0) {
    decision = "INSUFFICIENT_DATA";
  } else if (goCount >= 2) {
    decision = "GO";
  }

  return {
    decision,
    go_count: goCount,
    required_total: REQUIRED_BENCHMARKS.length,
    missing_benchmarks: missing,
    required_results: requiredResults.map((item) => ({
      benchmark_id: item.benchmark_id,
      verdict: item.report?.verdict || null,
      weighted_total_score: item.report?.weighted_total_score ?? null,
      iteration_count: item.report?.iteration_count ?? null,
      max_iterations: item.report?.max_iterations ?? null,
      quality_report_path: item.report?.quality_report_path || null,
    })),
  };
}

async function loadPocReports(reportsDirAbs) {
  let entries = [];
  try {
    entries = await readdir(reportsDirAbs, { withFileTypes: true });
  } catch {
    return [];
  }

  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const absPath = resolve(reportsDirAbs, entry.name);
    let payload;
    try {
      payload = JSON.parse(await readFile(absPath, "utf-8"));
    } catch {
      continue;
    }

    const report = payload?.report;
    if (!report || report.schema_version !== "poc-quality-report-v1") continue;
    reports.push({
      ...report,
      generated_at: payload.generated_at || "",
      _file: absPath,
    });
  }
  return reports;
}

function printHuman(result, reportsDirAbs, reportCount) {
  console.log("PoC Quality Summary");
  console.log(`Reports dir: ${reportsDirAbs}`);
  console.log(`PoC reports found: ${reportCount}`);
  console.log("");
  console.log(
    `Decision: ${result.decision} (go_count=${result.go_count}/${result.required_total})`
  );
  if (result.missing_benchmarks.length > 0) {
    console.log(`Missing: ${result.missing_benchmarks.join(", ")}`);
  }
  console.log("");
  console.log("Latest per benchmark:");
  for (const row of result.required_results) {
    console.log(
      `- ${row.benchmark_id}: verdict=${row.verdict || "n/a"}, score=${row.weighted_total_score ?? "n/a"}, iteration=${row.iteration_count ?? "n/a"}/${row.max_iterations ?? "n/a"}`
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const reportsDirAbs = resolve(process.cwd(), opts.reportsDir);
  const reports = await loadPocReports(reportsDirAbs);
  const latest = pickLatestByBenchmark(reports);
  const summary = evaluateDecision(latest);

  const output = {
    reports_dir: reportsDirAbs,
    report_count: reports.length,
    ...summary,
  };

  if (opts.asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printHuman(summary, reportsDirAbs, reports.length);
  }

  process.exit(output.decision === "GO" ? 0 : 1);
}

main().catch((err) => {
  console.error(`poc-quality-summary failed: ${err.message}`);
  process.exit(2);
});
