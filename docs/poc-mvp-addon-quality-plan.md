# PoC-First Add-on + Quality Plan

## Why This Exists

This plan is the execution path for the core product goal:

1. Generated games must reliably work.
2. Generated games must stop feeling like tutorial output.
3. Generated games must look intentional and visually meaningful.

We start with a strict Proof of Concept (PoC), then only scale if results are real.

## Current Baseline (As of 2026-02-17)

Already implemented in the toolchain:

1. Hard phase completion rejection when errors exist.
2. Objective Phase 5/6 quality gate evaluation.
3. Dock quality gate checklist visualization.
4. Saved quality reports in `res://.claude/quality_reports/`.
5. MCP reader for latest quality reports (`godot_get_latest_quality_report`).

This baseline gives us enforcement and observability. The next step is proving better outcomes.

## Phase 0: Proof of Concept (PoC)

### PoC Goal

Prove, in a timeboxed vertical slice, that this approach can produce a playable and non-tutorial game quality level.

### PoC Hypotheses

1. Reliability hypothesis: add-on integration can be installed, verified, and kept stable across build iterations.
2. Quality hypothesis: guided quality iteration can move output above tutorial baseline.

### PoC Scope (Intentionally Narrow)

1. One game archetype only (single benchmark prompt family).
2. One polished add-on path only (camera/polish pack first).
3. Max 3 quality-improvement cycles per run.
4. Fixed timebox: 5 working days.

### PoC Success Criteria (Go/No-Go)

PoC is "Go" only if all pass:

1. 0 script errors at final completion.
2. Full playable flow works: menu -> gameplay -> lose/win -> restart.
3. Objective quality gates for late phases pass.
4. Visual quality score reaches target (`>= 80` overall, visual category `>= 4/5`).
5. At least 2 out of 3 benchmark runs are judged non-tutorial by rubric checks.

### PoC Deliverables

1. `pack_polish` implemented end-to-end with install + verify.
2. Fixed benchmark prompt set (3 prompts) committed to repo.
3. Structured quality report for each run with `next_actions`.
4. Short evaluator checklist for "tutorial-like vs meaningful".
5. One demo scene/game build artifact for internal validation.

### PoC Non-Goals

1. No large catalog breadth.
2. No broad multi-genre guarantees.
3. No marketplace-style UI.

## Phase 1: MVP (After PoC Go)

### MVP Goal

Ship minimum production capability that consistently produces better-than-tutorial games for a constrained set of requests.

### MVP Scope

1. Curated add-on catalog with compatibility metadata.
2. MCP add-on operations:
   - `godot_list_addons`
   - `godot_install_addon`
   - `godot_verify_addon`
   - `godot_remove_addon`
   - `godot_apply_integration_pack`
3. Integration packs:
   - `pack_polish` (first)
   - `pack_testing`
   - `pack_ai` (single framework default + fallback)
4. Phase completion gates include add-on health checks.
5. Iterative quality loop capped with explicit escalation behavior.

### MVP Exit Criteria

1. At least 1 integration pack is reliably used in generated builds.
2. Add-on verification blocks false "build complete" outcomes.
3. Benchmark runs show improvement versus baseline across reliability and visual quality.
4. Quality reports are available for each run and used for targeted iteration.

## Full Expansion Path (After MVP)

Use `docs/phase1-addon-roadmap.md` for detailed week-by-week expansion.

High-level sequence:

1. Expand curated add-on catalog breadth.
2. Add pack-specific smoke tests and compatibility matrix.
3. Increase quality gate sophistication (visual coherence and gameplay depth proxies).
4. Add lockfile/version pinning and fallback/mirroring strategies.

## Quality Strategy (Anti-Tutorial Bar)

The product should enforce three layers:

1. Hard gates: no errors, no broken flow, no fake completion.
2. Objective gates: measurable late-phase polish and readiness checks.
3. Rubric scoring: weighted quality judgment with explicit minimums per category.

Target outcome for "very good game" status:

1. Hard gates pass.
2. Total quality score >= 85.
3. Visual polish/cohesion >= 4/5.
4. Controls/game feel >= 4/5.
5. Progression/variety >= 4/5.

## Immediate Execution Order

1. PoC PR A: define benchmark prompts + evaluator checklist + scoring schema.
   - Artifacts: `docs/poc/benchmark-prompts.md`, `docs/poc/evaluator-checklist.md`, `docs/poc/quality-scoring-schema.json`
2. PoC PR B: ship `pack_polish` installer/verifier slice with hard failure behavior.
3. PoC PR C: wire rubric scoring + iteration policy (max 3 loops, then escalate).
4. PoC Validation: run 3 benchmark builds, compare reports, publish Go/No-Go decision.

## Decision Rules

1. If PoC fails reliability criteria, stop and fix integration robustness before adding breadth.
2. If PoC passes reliability but fails quality, prioritize visual/game-feel systems before new packs.
3. Only move to MVP when both reliability and non-tutorial quality signals pass together.
