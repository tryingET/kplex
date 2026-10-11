# Temporary plan-only handoff for issue #119

Prepared by Zsolt's Codex Agent on 2026-10-11. P1 implementation handoff only; not a fix.

- Issue: https://github.com/zsviczian/kplex/issues/119
- Assessment: https://github.com/zsviczian/kplex/issues/119#issuecomment-6109361661
- Base: `main@2b128c89555b88ebf207a709d7c0669bed3dfd73`
- Workspace: `2026-10-11-issue-119-sync-menu-anchor`

The associated draft PR holds the implementation plan and acceptance criteria. Restore sync-menu anchoring at the invoking control without bypassing ActionManager, changing Sidecar/link-mode semantics, or introducing a second menu implementation. Preserve keyboard, owning-document, popout and menu-cleanup behavior.

Before offline transfer, the main agent copies the current PR scope, evidence and acceptance criteria into the single root `HANDOFF.md`, preserving its standing header. Include the actual source baseline and any required local evidence; do not assume the offline agent can access GitHub. The historical issue-54 return is not this assignment. Read `AGENTS.md`, `CONTRIBUTING.md`, `docs/AGENT_WORKFLOW.md` and `docs/agent-workflows/issue-resolution.md`.

The offline agent returns uncommitted changes and actual checks/limitations. The main agent independently reviews, validates and publishes to this same branch under maintainer authorization. Carry forward the documented baseline source-startup test failure without calling it a pass or expanding this task to fix it.

Remove this temporary file before final review; do not archive it. Keep the PR in draft until validation is complete or limitations explicitly accepted. Do not close the issue merely because a PR exists, merge, or release without authorization.
