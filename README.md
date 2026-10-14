# PR #163 startup evidence — implementation checkpoint

Explicitly approved by the maintainer for this public evidence branch on 2026-10-14.
Implementation: `6369d3d`. Accepted merged baseline: `ae473fc`.
Large-vault preparation/timing is still in progress and is not included in this checkpoint.

`archive.zip`: SHA-256 `0d8e45a5c6d384786ab13c6db23cec778a5cc4f0021d6ed9dcb211e092585729`; 36 entries, each with byte count/SHA-256 in `MANIFEST.json`.
All entries, the exact entry set, CRCs and hashes were verified before publication and again after download.
No vault configuration backups or note/cache payloads are included. The personal-vault receipt is
passive historical aggregate observation, not a controlled benchmark or a newly proven historical trigger.

## Reproduce

Use Node 22.22.2 and the committed lockfile at `6369d3d`.
Run `npm run verify:obsidian` with the explicit authorized disposable small-vault variables.
The archive contains the full verification log, native/foreground reports and actual artifacts.
Run `node scripts/testing/warm-restart-coordinator.mjs --baseline-ref=ae473fc`, then without the
baseline option, for the real-IDB work-count comparison. Setup is excluded; this is not startup timing.

For the diagnostic baseline, copy archived `source/diagnostic-baseline/GraphIndex.ts` and
`IndexedDbCache.ts` to `src/index/` and `supportReportProjection.ts` to `src/application/` in a disposable
source checkout of the implementation, then build normally. Expected main SHA-256:
`98d532fd63fa31179af4eeb4430b21ed94492145b1f822e69818f271967ad308`.
The in-memory reconstruction and matching identity are archived. All remaining source is pinned by
`6369d3d`; the build/lockfile copies record dependencies.
Candidate main: `b1b1b96801c55466d8269dca244f522482da10b06cf147595bc950c9d6692032`.
Merged baseline main: `0e0d599107d4efbd565a215f8544716831fd044a830317d362ac3f14a67dc9f4`.

The existing synthetic fixture is reproducible with `scripts/testing/generate-high-node-vault.mjs`;
its verified input manifest is archived. Never create/overwrite another vault without consent.
The native driver refuses personal vaults. Read the PR validation report before interpreting timings.
Initial red regression and excluded folder-fixture mistakes are retained; they are not acceptance trials.

## Verify independently

Use Python `zipfile.ZipFile.testzip()`, then compare every payload byte count and SHA-256 against
`MANIFEST.json`. Also require the entry set to equal its keys plus `MANIFEST.json` exactly.
