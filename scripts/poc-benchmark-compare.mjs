#!/usr/bin/env node
import { readdir, readFile } from "fs/promises";
import { resolve } from "path";

const DEFAULT_BENCHMARKS = [
  "poc_prompt_01",
  "poc_prompt_02",
  "poc_prompt_03",
];

function printHelp() {
  console.log(
    [
      "Usage: node scripts/poc-benchmark-compare.mjs [options]",
      "",
      "Compare two PoC cohorts (baseline vs candidate) using saved",
      "poc-quality-report-v1 files in .claude/quality_reports.",
      "",
      "Options:",
      "  --dir <path>                  Reports directory (default: .claude/quality_reports)",
      "  --baseline-prefix <prefix>    run_id prefix for baseline cohort (default: baseline)",
      "  --candidate-prefix <prefix>   run_id prefix for candidate cohort (default: candidate)",
      "  --benchmarks <csv>            Comma-separated benchmark IDs (default: poc_prompt_01..03)",
      "  --min-score-delta <n>         Score delta threshold for BETTER/WORSE (default: 3)",
      "  --json                        JSON output",
      "  -h, --help                    Show help",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const opts = {
    reportsDir: ".claude/quality_reports",
    baselinePrefix: "baseline",
    candidatePrefix: "candidate",
    benchmarks: [...DEFAULT_BENCHMARKS],
    minScoreDelta: 3,
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
    if (arg === "--baseline-prefix") {
      opts.baselinePrefix = argv[i + 1] || opts.baselinePrefix;
      i += 1;
      continue;
    }
    if (arg === "--candidate-prefix") {
      opts.candidatePrefix = argv[i + 1] || opts.candidatePrefix;
      i += 1;
      continue;
    }
    if (arg === "--benchmarks") {
      const raw = argv[i + 1] || "";
      const parsed = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (parsed.length > 0) {
        opts.benchmarks = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--min-score-delta") {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        opts.minScoreDelta = parsed;
      }
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

function safeDate(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

function reportTimestamp(report) {
  return safeDate(report.timestamp_utc) || safeDate(report.generated_at);
}

function avg(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
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

function selectLatestByBenchmark(reports, runPrefix) {
  const latest = new Map();
  for (const report of reports) {
    const runId = typeof report.run_id === "string" ? report.run_id : "";
    if (!runId.startsWith(runPrefix)) continue;
    const benchmarkId = report.benchmark_id || "unknown";
    const existing = latest.get(benchmarkId);
    if (!existing) {
      latest.set(benchmarkId, report);
      continue;
    }
    const existingTs = reportTimestamp(existing);
    const currentTs = reportTimestamp(report);
    if (!existingTs || (currentTs && currentTs > existingTs)) {
      latest.set(benchmarkId, report);
    }
  }
  return latest;
}

function summarizeCohort(name, runPrefix, benchmarks, reports) {
  const latestByBenchmark = selectLatestByBenchmark(reports, runPrefix);
  const rows = benchmarks.map((benchmarkId) => {
    const report = latestByBenchmark.get(benchmarkId) || null;
    return {
      benchmark_id: benchmarkId,
      run_id: report?.run_id || null,
      verdict: report?.verdict || null,
      weighted_total_score: report?.weighted_total_score ?? null,
      gates_passed: report?.gates_passed ?? null,
      very_good_status: report?.very_good_status ?? null,
      quality_report_path: report?.quality_report_path || null,
      timestamp_utc: report?.timestamp_utc || report?.generated_at || null,
    };
  });

  const available = rows.filter((row) => row.verdict !== null);
  const scores = available
    .map((row) => row.weighted_total_score)
    .filter((value) => Number.isFinite(value));
  const goCount = available.filter((row) => row.verdict === "go").length;
  const noGoCount = available.filter((row) => row.verdict === "no_go").length;
  const needsIterationCount = available.filter(
    (row) => row.verdict === "needs_iteration"
  ).length;
  const veryGoodCount = available.filter((row) => row.very_good_status === true)
    .length;
  const missingBenchmarks = rows
    .filter((row) => row.verdict === null)
    .map((row) => row.benchmark_id);

  const cohortReports = reports.filter((report) =>
    (typeof report.run_id === "string" ? report.run_id : "").startsWith(runPrefix)
  );

  return {
    name,
    run_prefix: runPrefix,
    report_files_matched: cohortReports.length,
    latest_per_benchmark: rows,
    missing_benchmarks: missingBenchmarks,
    complete: missingBenchmarks.length === 0,
    go_count: goCount,
    no_go_count: noGoCount,
    needs_iteration_count: needsIterationCount,
    very_good_count: veryGoodCount,
    average_weighted_score: avg(scores),
  };
}

function compareCohorts(baseline, candidate, minScoreDelta) {
  const hasComparableScores =
    Number.isFinite(baseline.average_weighted_score) &&
    Number.isFinite(candidate.average_weighted_score);
  const scoreDelta = hasComparableScores
    ? Number(
        (
          candidate.average_weighted_score - baseline.average_weighted_score
        ).toFixed(2)
      )
    : null;
  const goDelta = candidate.go_count - baseline.go_count;

  let verdict = "INSUFFICIENT_DATA";
  if (baseline.complete && candidate.complete && hasComparableScores) {
    if (goDelta > 0 || scoreDelta >= minScoreDelta) {
      verdict = "BETTER";
    } else if (goDelta < 0 || scoreDelta <= -minScoreDelta) {
      verdict = "WORSE";
    } else {
      verdict = "SAME";
    }
  }

  return {
    verdict,
    min_score_delta: minScoreDelta,
    go_delta: goDelta,
    average_score_delta: scoreDelta,
  };
}

function printCohort(label, cohort) {
  console.log(`${label} (${cohort.run_prefix})`);
  console.log(
    `  complete=${cohort.complete} matched_reports=${cohort.report_files_matched} avg_score=${cohort.average_weighted_score ?? "n/a"} go=${cohort.go_count} no_go=${cohort.no_go_count} needs_iteration=${cohort.needs_iteration_count}`
  );
  if (cohort.missing_benchmarks.length > 0) {
    console.log(`  missing: ${cohort.missing_benchmarks.join(", ")}`);
  }
  for (const row of cohort.latest_per_benchmark) {
    console.log(
      `  - ${row.benchmark_id}: verdict=${row.verdict ?? "n/a"}, score=${row.weighted_total_score ?? "n/a"}, run_id=${row.run_id ?? "n/a"}`
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const reportsDirAbs = resolve(process.cwd(), opts.reportsDir);
  const reports = await loadPocReports(reportsDirAbs);

  const baseline = summarizeCohort(
    "baseline",
    opts.baselinePrefix,
    opts.benchmarks,
    reports
  );
  const candidate = summarizeCohort(
    "candidate",
    opts.candidatePrefix,
    opts.benchmarks,
    reports
  );
  const comparison = compareCohorts(
    baseline,
    candidate,
    opts.minScoreDelta
  );

  const output = {
    reports_dir: reportsDirAbs,
    benchmarks: opts.benchmarks,
    baseline,
    candidate,
    comparison,
  };

  if (opts.asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("PoC Benchmark Comparison");
    console.log(`Reports dir: ${reportsDirAbs}`);
    console.log("");
    printCohort("Baseline", baseline);
    console.log("");
    printCohort("Candidate", candidate);
    console.log("");
    console.log(
      `Comparison verdict=${comparison.verdict} go_delta=${comparison.go_delta} avg_score_delta=${comparison.average_score_delta ?? "n/a"} (threshold=${comparison.min_score_delta})`
    );
  }

  if (comparison.verdict === "BETTER" || comparison.verdict === "SAME") {
    process.exit(0);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(`poc-benchmark-compare failed: ${err.message}`);
  process.exit(2);
});
