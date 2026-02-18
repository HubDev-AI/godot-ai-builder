# MVP Local Backend Plan (Codex Direction)

## Goal

Move the project from cloud-only execution to a backend-switch model where local Codex is a first-class path.

## Scope (MVP)

1. Keep current Godot bridge + MCP tools unchanged.
2. Add backend launcher switch:
   - `cloud` (Claude plugin-dir flow)
   - `local_codex` (Codex local execution flow)
3. Validate first add-on path (`pack_polish`) with a strict GO/NO_GO check.

## Why This Order

1. The MCP toolchain is stable and already enforces quality gates.
2. Backend swap should not break bridge protocols.
3. First add-on reliability is the narrowest PoC for production value.

## Phase A: Backend Switch Scaffold

1. Add `start-ai-builder.sh` with `AI_BUILDER_BACKEND`.
2. Keep `start-claude-ai-builder.sh` for backward compatibility.
3. Document backend modes in README.

Exit criteria:
1. Both launch modes can start without modifying project files manually.
2. Existing cloud flow remains backward compatible.

## Phase B: First Add-on Reliability Gate

1. Run `godot_apply_integration_pack(pack_polish, strict=true)`.
2. Verify `phantom_camera` health.
3. Reload editor filesystem.
4. Check errors/warnings.
5. Produce GO/NO_GO verdict.

Exit criteria:
1. Add-on install and verify pass.
2. Post-install errors = 0, warnings = 0.

## Phase C: Quality Impact Check

1. Run benchmark prompt set after add-on pass.
2. Compare rubric reports against pre-add-on runs.
3. Keep only changes that improve or keep score while preserving reliability.

Exit criteria:
1. No regression in reliability.
2. Quality decision remains GO.
