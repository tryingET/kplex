# PR #153 performance evidence, 2026-10-14

This archive preserves complete committed raw measurement sets, checkpoint reports (including failed/preliminary attempts), relevant source/test/tool snapshots, and retained local measurement/verification output before cleanup. Handoffs are transient and deliberately not archived. Original vault configuration payloads and generated dependency/build trees are excluded; configuration hash/restoration receipts and exact artifact identities remain.

Source: https://github.com/zsviczian/kplex/tree/cc0aacd01a0ab9b3497c18f8b85e0398fe61e8dc
PR base: df5335808aacfd6a11ac7ff4ef008f9406f27893
Aggregate baseline A: a162044; accepted runtime B5: cacefe5. Other baselines and failed attempts are identified in each original report/receipt. The aggregate report is repository/docs/validation/indexing-native-url-aggregate-2026-10-14.md. Start with its environment-and-sources.json, matched-analysis.json, per-pair JSON and final-audit.json. Local support files are supplemental, not automatically accepted samples.

## Reproduce

Use Node 22.22.2 and npm i in a separate checkout of the exact source revision. Use the installed Obsidian types and real production build. Never substitute an empty cache row for a genuine source owner. Follow CONTRIBUTING.md and docs/OBSIDIAN_RUNTIME_TESTING.md for explicit disposable-vault identity, foreground focus, exact-build staging, serial native work, and cleanup. Baseline artifacts must be built from the named baseline source, not reconstructed from current source with renamed labels.

Generate a NEW owned fixture directory (never overwrite an existing vault):

    node scripts/testing/generate-high-node-vault.mjs --out /absolute/new-fixture --files 20000
    node scripts/testing/generate-high-node-vault.mjs --verify /absolute/new-fixture

The actual fixture root was C:/Obsidian/kplex-test/Indexing-performance-153, with 20,000 notes, 8,831,230 Markdown bytes, 80,000 distinct placeholders, 8,000 child URL targets and 259,000 source occurrences. Content SHA-256: 50b8cb12ef83c3cd62f1605390fe6ff793079a9f6e37e471e59d0060cf287cd0. This is NOT Synthetic-Scale-v2. The complete tested help+fixture vault had 20,088 Markdown notes, 20,107 files, 15 folders including root. Exact host mtime/ctime and help-note facts are captured by receipts; a newly generated fixture will have different physical identities.

Populate actual current URL-owner facts via normal production discovery; wait for completion before timing. Aggregate trials seed those real current rows into isolated namespaces outside timing. URL rows are warm/current; graph snapshot, body cache, neutral heads and dependency inventory are absent. Never purge the main vault to imitate this setup. Reference seed digest f4efd617186c7464198e8a8ca7073fed49d3e2a23d73f80af76f21e87014f5af; graph/evidence digest 31a78202bb997736c2ea056a0d3e1865070e0454f0c04f023f6f9688f8042d50. Graph totals 16,069 pages (8,040 URLs plus 8,029 Markdown owners) and 16,127 declarations; shared-origin degree 8,000. Recompute full digests on a new host; do not loosen semantic/source guards to force a historical hash.

Set KPLEX_TEST_VAULT_NAME=kplex-test, KPLEX_TEST_VAULT_PATH to the verified absolute vault, KPLEX_TEST_CONFIG_DIR to its actual config directory, and a fresh KPLEX_HOST_REPORT_DIR for EVERY condition. Drivers require the authorized large-vault name and actual matching artifacts. For A set KPLEX_PROBE_BASELINE_REF=a162044 and KPLEX_PROBE_ARTIFACT_DIR to that exact build; stage it first. Unset both for B5. Run serially:

    node scripts/testing/obsidian/largeUrlReplay.mjs
    node scripts/testing/obsidian/largeUrlMemory.mjs

Use KPLEX_URL_MEMORY_MODE=retained (five pairs, explicit GC outside API timing) or unforced (three pairs, complete bounded GC/flush observations). Use three original CLI pairs for low-instrumentation elapsed time: first lifetime counts work, second lifetime supplies time. Reverse baseline/candidate order in even pairs. Keep native foreground/throttling and production five-second publication cadence. Do not add inclusive GC/flush/method intervals or combine forced-GC/counting timings with low-instrumentation timings. Actual paint, full startup, process peak, macOS and physical mobile remain separate.

Portable work counters: node scripts/testing/url-adjacency-work.mjs --baseline-ref=a162044, then without the flag; later representation comparisons also pin --adjacency-baseline-ref. See the original checkpoint reports for the matching baseline flags of other reusable benchmarks and original sample order. Regression/full acceptance: npm run verify; configured native lane: npm run verify:obsidian; focused foreground: node scripts/testing/obsidian/foreground.mjs.

Accepted runtime SHA-256:
main.js 0e0d599107d4efbd565a215f8544716831fd044a830317d362ac3f14a67dc9f4
manifest.json 19d9ecce5557733e0ff0f2e27155e635c30158c3cfa6fbca0f11c16e4dedfd2c
styles.css e8c9279e8904888aa71d5dd2b01f320d5b32fd10e15feb0b9a9576a34f11cea3

MANIFEST.json records every payload byte length, SHA-256, and immutable Git blob reference when available. SHA256SUMS verifies payloads plus the manifest itself. The outer SHA256SUMS file verifies the ZIP. verify-archive.py validates the ZIP CRCs, complete entry inventory, every payload digest, and every provenance byte length. The verifier is also copied outside the archive. Old reports retain historical pending-acceptance wording; the final report records the maintainer's subsequent acceptance and supersedes it.
