# Standing instructions — preserve this header

This is a temporary handoff document between agents. The development of the solution involves agents with access to Obsidian CLI and a full development environment with all node packages installed, but also agents with more limited access. Development is done in "ping-pong" between these two types of agents. Agents should use this document to pass instructions and status from one another, such as instructions for testing/validation, or instructions for development work that can only be done in a full environment.

## Mixed agent handoff

### Instructions

The **offline development agent has no Obsidian CLI/runtime access** and performs most scoped implementation and substantial trace analysis. Its Node/dependency/browser/network/Git capabilities must be recorded, not assumed. The **main validation agent has Obsidian CLI and a full dependency environment** and prepares assignments, captures runtime evidence, reviews/fixes returns, performs native validation and handles authorized Git/PR actions. Host-only probes or supporting development can be requested from the main agent and the resulting evidence sent back for offline analysis.

Follow `AGENTS.md`, `CONTRIBUTING.md` and [the mixed agent workflow](docs/AGENT_WORKFLOW.md). Keep this single handoff transient: preserve the opening note/standing instructions and overwrite the assignment/results below on each transfer, in either direction. Do not archive handoffs or append a session history. Persist accepted architecture/checkpoint decisions and limitations in `Refactor plan.md`; feature-specific evidence belongs in its issue/PR or a reviewed validation report.

Return uncommitted changes and actual results for main-agent review unless the maintainer explicitly assigns other repository authority. Missing prerequisites/tests remain pending; a skip is not a pass. The main agent independently reviews, runs applicable checks, fixes defects and recommends only necessary prioritized manual checks. Commit/PR/merge/release steps follow applicable maintainer authorization after required validation or explicit acceptance of a recorded limitation.

Obsidian is the production host; preserve the established portable semantic, identity/source, publication/revision, localization and environment boundaries.



---

# PR #140 / issue #93 — accepted implementation

Direction: main implementation/validation agent → maintainer. Validation captured uncommitted work on `2026-10-11-issue-93-mobile-sidecar-latency`, plan HEAD `cf22a744decf7a95fce9c2c29260190f6febfcf5`. Accepted main `b2abcbaf15ed3c6c52fecd84dd225ca7265be361` is integrated in a conflict-free pending merge. Review `git diff origin/main` plus untracked files; staged accepted-main changes are not #140 scope. The temporary issue plan is removed. The maintainer subsequently authorized commit, push, merge and issue closure with a PR reference on 2026-10-12, accepting the recorded launcher limitation for publication. Final Git identity is recorded by PR #140. No release is included. Refactoring remains paused at C14.

The native baseline reproduces 24 opens/12 warm Sidecar switches and a lost latest target during rapid navigation. Linked destinations now delegate to the existing Sidecar request owner while preserving recent-leaf bookkeeping. Same-leaf native work serializes, obsolete queued targets skip opening, known superseded native echoes cannot change the center, and native completion releases before storage. A→B→A finishes initial mode without reopening; already-correct passive mode skips a native update. Explicit routes and canonical file/incarnation, rename, attachment, adjacency, request and unload fences remain intact. No index rewrite, migration, animation removal, sync-policy change or production diagnostics.

Final Node 22.22.2 / installed Obsidian types 1.13.0: architecture 7/7, zero violations; core 94/94; scanner lint zero errors/warnings; general lane rerun on final source 719/719; affected follow/host-yield/scheduler tests 59/59; portable source 334/334 and IndexedDB/browser source 442/442 including default 20,015-record and startup duplicate-read coverage; real production build passed.

Final exact built/installed main.js SHA-256 `ee2fdd42b152351c4a1848176088149fc90d37fd3caa4a64113991260f7766e0`. Native Obsidian 1.14.4 (installer 1.14.0), Darwin 23.5.0: Sidecar 38 scenarios each on desktop and 900×875 tablet emulation; sidebar 8/8 each on desktop and 390px phone emulation; menu/migration 14/14. One open per managed switch; no same-file/camera opens/body reads/rebuilds; same-size ordinary-pane control and newest-target settlement. All cleanup/configuration restoration succeeded. No captured JavaScript errors.

The full strict gate remains FAILED: architecture/core/lint passed, first lane 719/719, then UI browser 40/60 with 20 unchanged Chrome dump-dom launch timeouts, zero skips. `tests/ui-components.test.mjs` matches accepted main byte for byte; no deadlines/assertions were weakened. Strict staging was not reached; exact-build staging/native and source lanes were separately completed. The final recent-leaf compatibility preservation was rechecked with the general/affected lanes, architecture/lint/build and native matrix. The current maintainer authorization accepts this recorded launcher limitation; the gate status remains failed.

Probe corrections are recorded rather than hidden: phone waits for actual native drawer dismissal instead of an insufficient fixed delay, with no extra close/reopen; tablet fixtures start after normal source-backed startup readiness. A final post-reload prerequisite expired before sampling, cleanup succeeded, subsequent inspection confirmed ready/visible/focused, and unchanged checks passed on retry. These findings prompted no speculative product changes.

The maintainer reports prior full-project Windows tests passed without Chromium timeouts, and PR #138 Linux CI passed. Neither is a #140 candidate test pass. Publication is authorized by the current maintainer instruction. Physical Huawei/HarmonyOS latency/touch and the reporting Android phone's actual WebView/sidebar lifecycle remain pending. Measured native work is reduced; the reported 1–1.5-second physical delay is not claimed resolved.

Durable evidence: [validation](docs/validation/sidecar-latency-2026-10-12.md) and adjacent JSON contain exact source/runtime/artifact/report hashes, baseline failures, descriptive timing distributions and all actual limits. Native wrappers/controllers, fixtures and emulation are removed/restored; runtime debug-prefix searches are clean.
