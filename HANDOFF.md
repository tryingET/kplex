# Standing instructions — preserve this header

This is a temporary handoff document between agents. The development of the solution involves agents with access to Obsidian CLI and a full development environment with all node packages installed, but also agents with more limited access. Development is done in "ping-pong" between these two types of agents. Agents should use this document to pass instructions and status from one another, such as instructions for testing/validation, or instructions for development work that can only be done in a full environment.

## Mixed agent handoff

### Instructions

The **offline development agent has no Obsidian CLI/runtime access** and performs most scoped implementation and substantial trace analysis. Its Node/dependency/browser/network/Git capabilities must be recorded, not assumed. The **main validation agent has Obsidian CLI and a full dependency environment** and prepares assignments, captures runtime evidence, reviews/fixes returns, performs native validation and handles authorized Git/PR actions. Host-only probes or supporting development can be requested from the main agent and the resulting evidence sent back for offline analysis.

Follow `AGENTS.md`, `CONTRIBUTING.md` and [the mixed agent workflow](docs/AGENT_WORKFLOW.md). Keep this single handoff transient: preserve the opening note/standing instructions and overwrite the assignment/results below on each transfer, in either direction. Do not archive handoffs or append a session history. Persist accepted architecture/checkpoint decisions and limitations in `Refactor plan.md`; feature-specific evidence belongs in its issue/PR or a reviewed validation report.

Return uncommitted changes and actual results for main-agent review unless the maintainer explicitly assigns other repository authority. Missing prerequisites/tests remain pending; a skip is not a pass. The main agent independently reviews, runs applicable checks, fixes defects and recommends only necessary prioritized manual checks. Commit/PR/merge/release steps follow applicable maintainer authorization after required validation or explicit acceptance of a recorded limitation.

Obsidian is the production host; preserve the established portable semantic, identity/source, publication/revision, localization and environment boundaries.



---

# PR #138 / issue #119 — publication authorized

Direction: main implementation/validation agent → maintainer. The maintainer explicitly authorized commit, push, finalizing/merging the existing PR #138, closing issue #119 with a PR reference, and switching to main/fetching. The recorded full-gate limitation is accepted for publication; the maintainer will run the failed tests on Windows for the entire project. No release is requested. Refactoring remains paused at C14.

Validation capture: branch `2026-10-11-issue-119-sync-menu-anchor`, plan HEAD `86529545f7454a52184f678548d0f0cce117f9aa`, accepted main `e664f65f7f60aa92e67dcb42d847d2cece88cb82`, integrated without conflicts. These identify the uncommitted test capture; GitHub [PR #138](https://github.com/zsviczian/kplex/pull/138) records the subsequent publication and merge identities. The temporary issue plan is removed.

Implemented fresh surface-local sync/Sidecar control anchors and bounded same-pane fallback. Existing native Menu/actions/choices retain clamping, focus, dismissal and semantic ownership. Disposed/invisible roots cannot open menus. Host surface disposal captures its rendering document and releases only its current leaf/document menu lifetime; stale/foreign/successor owners remain protected.

Actual final checks on Node 22.22.2 and installed Obsidian types 1.13.0: architecture 7/7, zero violations; lint zero errors/warnings; affected action/host/menu tests 80/80; source portable 334/334 and browser/IndexedDB 441/441, including startup duplicate-read coverage; production build passed. Exact-build native DOM-Menu acceptance passed 14/14 on macOS Obsidian 1.14.4 (installer 1.14.0), with zero captured JavaScript errors and asserted configuration restoration.

The strict full gate remains failed: first lane 657/657; UI browser lane 40/60 with 20 unchanged Chrome dump-dom launch timeouts. It stopped before source/build/staging; those checks and exact-build native acceptance ran separately. After the disposal fix, all affected checks/build/native were rerun. No deadline/assertion was weakened. This is an explicitly accepted publication limitation, not a full verification pass.

Durable evidence: [validation report](docs/validation/sync-menu-anchor-2026-10-11.md) and adjacent JSON. Runtime inventory SHA-256 `8d065d8439f778628fa64c5cff0b105ff0a189c6f5c488622dfe89d16eee77fb`; exact installed/built main.js SHA-256 `72070fd305fbbdaa68dc54719d9a68be11f4e33a763232048efc54aafceecf94`.

Remaining platform evidence: full-project Windows verification and standard/OS-native Menu behavior in an offset pane/resized popout; physical phone/tablet sync/Sidecar tap/dismissal. The completed DOM-backend probe does not establish OS-native rendering or physical touch.
