# Phase 1 Add-on Roadmap

## Purpose

This document defines a concrete Phase 1 plan to extend Godot AI Builder with reliable add-on integration.
The immediate goal is to move from "code generation only" toward "generation plus verified ecosystem setup."

## Phase 1 Goal

Deliver a dependable add-on workflow that can:

1. Discover curated add-ons from an internal catalog.
2. Install and verify selected add-ons in a Godot project.
3. Apply integration packs for common game needs.
4. Block completion when required integrations are broken.

Target duration: 4 weeks.

## Scope

In scope:

1. Curated add-on catalog and compatibility metadata.
2. MCP tools for list/install/verify/remove add-ons.
3. Integration packs for narrative, AI, polish, and testing.
4. Quality gates tied to add-on health and runtime checks.
5. Docs and smoke tests for each shipped pack.

Out of scope (Phase 2+):

1. Full auto-resolution of arbitrary third-party dependencies.
2. Multi-engine version matrix CI for every community add-on.
3. Automated migration support for all addon major upgrades.
4. UI-based marketplace browsing inside the plugin.

## Guiding Principles

1. Reliability over breadth: support fewer add-ons with stronger guarantees.
2. Deterministic setup: produce repeatable installs with version pinning.
3. Explicit compatibility: do not guess support; encode and verify it.
4. Fail loudly: surface actionable errors when integration gates fail.
5. Keep generated output editable: do not lock users into black-box assets.

## Proposed Add-on Catalog (Initial)

Start with high-signal categories and actively maintained projects:

1. Narrative:
   - `nathanhoad/godot_dialogue_manager`
2. AI Behaviors:
   - `limbonaut/limboai`
   - `bitbrain/beehave`
   - `derkork/godot-statecharts`
3. Polish/Camera:
   - `ramokz/phantom-camera`
4. Testing:
   - `godot-gdunit-labs/gdUnit4`
   - `bitwes/Gut`
5. Content Pipeline:
   - `viniciusgerevini/godot-aseprite-wizard`
   - `Kiamo2/YATI`

## Architecture Changes

### 1) Catalog and Compatibility Layer

Add `addons/catalog.json` with fields such as:

1. `id`
2. `name`
3. `source_url`
4. `install_method` (`zip`, `git`, `assetlib`)
5. `godot_min`
6. `godot_max`
7. `license`
8. `health` (maintained, caution, deprecated)
9. `fallback_addon_ids`
10. `verification` (files/classes/nodes expected)

### 2) New MCP Tools

Add the following tools to the MCP server:

1. `godot_list_addons`
2. `godot_install_addon`
3. `godot_verify_addon`
4. `godot_remove_addon`
5. `godot_apply_integration_pack`

### 3) Quality Gates

Before reporting build completion:

1. Verify add-on files exist.
2. Verify plugin is enabled in project settings.
3. Verify required classes/nodes can be resolved.
4. Verify no critical script errors.
5. If verification fails:
   - attempt fallback add-on if defined
   - otherwise return explicit remediation steps

## Integration Packs (Phase 1)

### `pack_narrative`

1. Install Dialogue Manager.
2. Scaffold a minimal dialogue controller wrapper.
3. Verify required script/class access.

### `pack_ai`

1. Install one AI framework (priority order: LimboAI, Beehave, Statecharts).
2. Generate starter behavior/state assets and bridge scripts.
3. Verify behavior runtime hooks compile.

### `pack_polish`

1. Install Phantom Camera.
2. Generate camera setup defaults (follow + transitions).
3. Verify plugin activation and scene compatibility.

### `pack_testing`

1. Install gdUnit4 (primary) or GUT (fallback).
2. Scaffold starter test file and runner command.
3. Verify test discovery runs without critical errors.

## Milestones and Timeline

### Week 1: Catalog Foundation

1. Create `addons/catalog.json` schema and validator.
2. Add first curated entries with compatibility metadata.
3. Implement basic list and compatibility query logic.

### Week 2: Installer and Verifier

1. Implement install/remove flows.
2. Add verification primitives (file/plugin/class checks).
3. Add robust error mapping and retry-safe behavior.

### Week 3: Pack Integration

1. Implement `godot_apply_integration_pack`.
2. Add narrative, AI, polish, and testing pack templates.
3. Add fallback strategy per pack.

### Week 4: Gates, Docs, and Smoke Tests

1. Enforce completion quality gates.
2. Add smoke tests for each integration pack.
3. Publish support matrix and troubleshooting docs.

## Acceptance Criteria

Phase 1 is complete when:

1. A user can request at least one integration pack in a prompt.
2. Required add-ons are installed and verified automatically.
3. Failed integration is caught before "build complete" is reported.
4. At least three packs pass smoke tests on supported Godot versions.
5. Troubleshooting output includes actionable next steps.

## Risks and Mitigations

1. Add-on API churn:
   - Pin tested versions and track compatibility in catalog metadata.
2. Godot version fragmentation:
   - Gate by explicit `godot_min`/`godot_max`, not assumptions.
3. External host/release instability:
   - support mirrored install sources where feasible.
4. Over-automation causing opaque failures:
   - preserve detailed logs and deterministic verification steps.

## Metrics to Track

1. Add-on install success rate.
2. Verification success rate by pack.
3. Build completion rate with packs enabled.
4. Mean time to recover from failed integration.
5. Number of fallback activations per add-on.

## Phase 2 Preview (Not Included Here)

1. Expanded catalog and auto-health scoring.
2. Multi-version validation in CI.
3. Optional in-editor pack configuration UI.
4. Project-level lockfile for add-on versions.

## Immediate Next Actions

1. Approve this roadmap as Phase 1 baseline.
2. Implement catalog schema and validator first.
3. Ship `godot_list_addons` and `godot_verify_addon` before installer automation.
4. Add one end-to-end pack (`pack_testing`) as the first vertical slice.
