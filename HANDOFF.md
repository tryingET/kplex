# Standing instructions — preserve this header

This is a temporary handoff document between agents. The development of the solution involves agents with access to Obsidian CLI and a full development environment with all node packages installed, but also agents with more limited access. Development is done in "ping-pong" between these two types of agents. Agents should use this document to pass instructions and status from one another, such as instructions for testing/validation, or instructions for development work that can only be done in a full environment.

## Mixed agent handoff

### Instructions

The **offline development agent has no Obsidian CLI/runtime access** and performs most scoped implementation and substantial trace analysis. Its Node/dependency/browser/network/Git capabilities must be recorded, not assumed. The **main validation agent has Obsidian CLI and a full dependency environment** and prepares assignments, captures runtime evidence, reviews/fixes returns, performs native validation and handles authorized Git/PR actions. Host-only probes or supporting development can be requested from the main agent and the resulting evidence sent back for offline analysis.

Follow `AGENTS.md`, `CONTRIBUTING.md` and [the mixed agent workflow](docs/AGENT_WORKFLOW.md). Keep this single handoff transient: preserve the opening note/standing instructions and overwrite the assignment/results below on each transfer, in either direction. Do not archive handoffs or append a session history. Persist accepted architecture/checkpoint decisions and limitations in `Refactor plan.md`; feature-specific evidence belongs in its issue/PR or a reviewed validation report.

Return uncommitted changes and actual results for main-agent review unless the maintainer explicitly assigns other repository authority. Missing prerequisites/tests remain pending; a skip is not a pass. The main agent independently reviews, runs applicable checks, fixes defects and recommends only necessary prioritized manual checks. Commit/PR/merge/release steps follow applicable maintainer authorization after required validation or explicit acceptance of a recorded limitation.

Obsidian is the production host; preserve the established portable semantic, identity/source, publication/revision, localization and environment boundaries.



---


# PR #146 / issue #143 — accepted publication handoff

Direction: main implementation/validation agent → maintainer. Validation captured uncommitted work on `2026-10-12-issue-143-style-save`, plan HEAD `0082327e9e5d46996df9d4a41f947a5a96e93f75`. Accepted main `fdb71942c71e6b5fa5f69586beb88ed01e13c047` is integrated by a conflict-free pending merge. Review the feature against accepted main plus untracked files; staged #140 main changes are not #146 scope. The temporary plan file is removed. The maintainer now authorizes commit, push, finalization and merge of existing PR #146, then switching to main and fetching, explicitly skipping repeated testing and the wait for GitHub validations. The recorded full-gate limitation is accepted for publication. No release is requested. Refactoring remains paused at accepted C14.

The real-manager baseline reaches disk and presentation completion, then stays open while the legacy semantic refresh is held. The style operation now uses the existing serialized settings disk queue and publishes its draft after durable completion. Later live field edits/imports are retained; failure cannot restore an old whole-settings snapshot. Storage failure preserves the draft; any post-storage publication/presentation/manager/native-close failure remains saved with recovery feedback. Pending controls/Cancel/Escape and committed duplicate delivery are excluded. External teardown retires UI completion without canceling a submitted write. Shared node/link lifecycle and existing translators/native controls are reused; node RGB edits preserve alpha, original unchanged spelling and sparse inheritance.

The canonical style-only exception covers only four manager dictionary/order keys; mixed settings retain existing effects. A new real-browser regression caught an actual retained-pair authority defect after tag priority changed. The existing canonical semantic signature now owns published pair validity; full compiler inputs still fence private preparation. Physical identity/cache/revision, source, semantic policy, lifetime and publication guards remain intact. No engine/source rewrite, schema/dependency change or production diagnostics.

Node 22.22.2 / installed Obsidian types 1.13.0: final focused migration/settings/localization 64/64; canonical general/indexing lane 735/735; architecture 7/7 (104 roots, 191 reachable files, zero violations); scanner zero errors/warnings; actual production build passed. Affected real-Chromium suites passed 112/112, including requested-pair terminal fences and the default 20,015-owner cached publication case. Root-wide closure is explicitly incomplete; no native scale-latency claim. Final style-host browser regression rerun after recovery additions passed 1/1 with retained authority/current facets and zero source work.

Final built/installed main.js SHA-256 `60dace396d127c442ca6d1d96b4f6f98969e212c56f9fc05313dbdb12c96326e`. Runtime source inventory `396e74682efea177cc278cb37127f437c14504a1c95a187b5cff62bffdec91d5`. Obsidian 1.14.4 (installer 1.14.0), Darwin 23.5.0: final native matrix 11/11, including no-view/active graph, actual separate Settings window, delayed/failed storage, post-save faults, duplicate Cancel/Escape, real RGB/alpha/inheritance, active tag priority retaining selected-pair editing authority, and native reload durability. Cleanup/configuration restoration succeeded. No captured JS errors; no probes, synthetic styles or style dialogs; desktop mode/local readiness restored.

Full `verify:obsidian` remains FAILED: architecture/core/lint passed, general 728/728 at capture, then browser 41/60 with 19 unchanged Chrome dump-dom launch timeouts at the existing deadline. Strict staging/source/build were not reached. The maintainer has explicitly accepted proceeding with this recorded limitation; no full-gate pass is claimed. Subsequent final lanes and separately staged native checks are distinct. The complete affected browser run preceded final UI/publication recovery/alpha additions; unchanged source/index owners were supplemented with final focused/general/style-host/native checks.

Harness findings are recorded rather than hidden: old baseline modal cleanup left stale managers; native backdrops replaced the assumed close icon; actual view IDs/readiness owner and Settings subpage document scope were corrected; setup reads from native Markdown activation were positively identified and retained separately. Unchanged post-reload prerequisites expired before sampling, followed by confirmed ready/foreground inspections and passing retries. A fixture lacked host tag facts and was corrected. These are not fabricated product failures or deadline waivers.

Self-review: canonical ownership, narrow capabilities, reuse, strict types, UI catalog/English fallback, TSDoc and resource/lifetime guards reviewed against repository rules. No temporary prefix in src/ or dist. Preserve exact schema/settings/public command/dependency compatibility. No structural milestone resumed.

Durable results and actual intermediate failures: [validation](docs/validation/style-operations-2026-10-13.md) and [JSON evidence](docs/validation/style-operations-2026-10-13.json). Publication is authorized on the existing branch/PR with the recorded limitation; use GitHub for the final commit and merge identities. Remaining checks: full final candidate verification on Windows, and a physical phone/tablet style save/delete/dismissal run. No automatic new assignment.
