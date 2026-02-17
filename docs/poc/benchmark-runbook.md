# PoC Benchmark Runbook

Use this before major feature work to verify code/game quality is improving.

## 1) Define Cohorts

Pick two run ID prefixes:

1. `baseline-YYYYMMDD`
2. `candidate-YYYYMMDD`

Example:

1. `baseline-2026-02-18`
2. `candidate-2026-02-18`

## 2) Run the Locked Prompt Set

Use `docs/poc/benchmark-prompts.md` (3 prompts, unchanged).

For each prompt, run the full build loop and call `godot_score_poc_quality` with:

1. `benchmark_id`: `poc_prompt_01` / `poc_prompt_02` / `poc_prompt_03`
2. `run_id`: `<cohort-prefix>-<benchmark_id>`
3. `iteration_count` and `max_iterations` from the run
4. all checklist and score fields required by the rubric

This stores reports in `res://.claude/quality_reports/`.

## 3) Compare Baseline vs Candidate

From the repo root:

```bash
node scripts/poc-benchmark-compare.mjs \
  --baseline-prefix baseline-2026-02-18 \
  --candidate-prefix candidate-2026-02-18
```

JSON output:

```bash
node scripts/poc-benchmark-compare.mjs \
  --baseline-prefix baseline-2026-02-18 \
  --candidate-prefix candidate-2026-02-18 \
  --json
```

## 4) Decision Rule

Treat as pass only when:

1. both cohorts are complete (all 3 benchmarks scored)
2. comparison verdict is `BETTER` or `SAME`
3. no benchmark regresses from `go` to `no_go`
