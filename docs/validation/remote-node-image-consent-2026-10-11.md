# Remote node image consent — PR #137

Implementation prepared on `2026-10-11-issue-127-remote-image-consent`,
head `684af400007233632b57023e3fccfd109f29da3f` (the temporary plan commit),
approved runtime base `2b128c89555b88ebf207a709d7c0669bed3dfd73`. Issue: [#127](https://github.com/zsviczian/kplex/issues/127).
**Full verification remains failed. The maintainer confirmed successful manual tests and authorized publication/merge after these failures were reported.**

## Behavior and ownership

**Allow remote node images** defaults off. Migration grants consent only for an explicit boolean
`true`; foreign ExcaliBrain graph imports preserve the local choice. The existing declarative
Node images group exposes the permission and host/IP/image-URL disclosure through the English
catalog; the two new keys use the existing explicit English fallback pending reviewed translations.

The existing link parser and GraphIndex imagery resolver classify resolved destinations, skipping
denied HTTP(S) candidates and selecting the first valid local candidate. Replacement/thumbnail
precedence and the existing frontmatter/inline fallback order remain intact among allowed values.
Absent imagery restores the normal node label. No accepted URL syntax or schemes were expanded.
Local Vault resource URLs remain host-owned: the rendering guard checks the resolved Vault file
path or remote destination, not the resource URL's spelling.

Consent participates in transient visual-cache signatures and a visual epoch. The real settings
save path clears cached visuals and notifies mounted surfaces before awaiting persistence. Prepared
presentation facades retain live consent. Durable-body responses and React visual/metadata callbacks
reject retired epochs and teardown; ThoughtNode checks consent before emitting image elements.
A consent-only save never refreshes semantic scopes. No graph schema, source cache, ontology,
image-only-link suppression, relationship classifier or semantic snapshot format changed.

Existing expanded mini-nodes remain label-only imagery consumers: their pages are absent from the
existing `visualPages` resolver input. The native test checks no-consent expanded layout, then
navigates each image-bearing note onto its ordinary image surface. This fix does not add expanded
imagery. Hover enlargement reuses the existing guarded image element. Requests authorized before
revocation cannot be undone, and host/browser caches are not purged.

## Evidence

Runtime: Node **22.22.2**, installed Obsidian declarations **1.13.0**. Native host:
Obsidian **1.14.4**, installer **1.14.0**, Darwin **23.5.0**. Browser discovery selected the installed
Google Chrome. Existing dependencies were used; package-lock/dependency versions are unchanged.

- Final `npm run check:architecture`: 7 tests pass; 104 migrated roots, 189 reachable files,
  zero violations. Final `npm run lint:obsidian`: clean.
- Final `npm run check:core`: 88 pass and restricted core typecheck pass.
- Existing indexing compatibility fixture: pass, including all 24 settings-independence scenarios.
  Its explicit compile inventory was extended for the new policy module. Old unconditional remote
  expectations now deliberately require opt-in and test cached opt-out.
- Full lane's portable aggregate: **651/651 pass**.
- Final consent plus migration/localization/declarative-settings suite: **32/32 pass**, including
  all **6/6** consent tests.
  Real Chromium/React/IndexedDB and a controlled loopback origin assert zero image arrivals before
  opt-in and no new arrivals after opt-out, both modes and inline paths, URL forms/local fallback,
  multiple documents, held reads/off-on/unload, live revocation and zero semantic work in the actual
  compiled settings-save method. The local-resource spelling regression inspects real React output
  without assigning a third-party URL to DOM. Actual PlexGraph effect callbacks also reject late
  promises on revoke/unmount and deferred React updaters after off/on, preserving cleanup.
- `npm run test:sources`: **333/333 pass**. `npm run test:sources:browser`: **427 pass/1 fail**
  at `tests/source-startup-indexeddb.test.mjs:539`: the offline-edit startup assertion sees
  `["A.md","A.md"]` instead of one read. The same assertion passes in isolated runs on both the
  approved runtime base and the implemented tree; the complete startup file separately passes
  **49/49 on each tree**. The suite failure remains failed; its cause is
  not established. Prior handoff evidence records the same assertion failure on an earlier host.
- Final `npm run build`: pass against actual installed typings, producing all three installable
  artifacts. No generated artifact is included as a source change.

`npm run verify` (through `npm run verify:obsidian`) failed at **19 existing `--dump-dom` UI test
launcher timeouts**, each at its unchanged 20-second bound. The combined browser UI lane recorded
39 pass/19 fail. Repeating the unchanged **FloatingLayer owner-document browser behavior** test
reproduced the same `spawnSync ... Google Chrome ETIMEDOUT`; its component, dependencies and test
source are unchanged from the approved base. The underlying launcher/environment cause is not
established. No timeout, test assertion, golden, lint or architecture rule was relaxed. The strict
native runner therefore did not stage artifacts. Remaining lanes were invoked separately, and full
verification remains failed rather than relabeled a pass.

A separate explicit staging step atomically installed the final successful production build in the
existing disposable **kplex-test-small** vault, after verifying its CLI-reported path. It preserved
settings, community enablement and workspace and verified the loaded instance and exact hashes.
`npm run verify:obsidian:remote-images` then passed **all five scenarios**:

1. No-consent main-window navigation, expanded layout and trusted hover; centered local image decodes.
2. Fresh no-consent native popout alongside the still-mounted main view; zero image arrivals.
3. Explicit opt-in in both native documents; all five controlled image URLs load when navigated into view.
4. Opt-out in both surfaces plus native frontmatter/metadata refresh; no new arrivals during revocation.
5. Saved explicit opt-in survives plugin reload; re-enabled imagery loads and subsequent opt-out removes it.

No native JavaScript errors were captured. Fixture folder, managed popout, probe and loopback server
were removed; runtime preferences/follow ownership/workspace and original configuration bytes were
restored. The final request to `/never-after-revoke.png` occurs only after deliberate re-enabling and
reload, outside the denied interval.

Earlier native setup failures are retained honestly: the initial tiny PNG had an invalid IDAT CRC;
a corrected PNG still remained lazily unloaded outside the viewport. Fixture-only DOM/cache evidence
showed a resolved `app://` image with `complete=false`; centering the note proved actual decoding.
Another setup assertion incorrectly expected images on expanded mini-nodes; source/DOM review showed
the existing label-only behavior. The final driver asserts the real central/first-level consumers and
separately navigates every controlled note. Every failed probe completed cleanup. These corrections
changed test setup/expectations, not production behavior or existing acceptance bounds.

## Pre-integration identities and review

Final `main.js` SHA256: `e2a47f009ec0f2e07711f0772e39e993ba79ee46de5fad22e040c080405f39da`.
Final `styles.css` SHA256: `e8c9279e8904888aa71d5dd2b01f320d5b32fd10e15feb0b9a9576a34f11cea3`.
Final `manifest.json` SHA256: `0beacdb94adc4a0ec318d69dba87fcb4dc9c1a86784058db341fdefe0dfb4250`.
Runtime source inventory SHA256: `011afe501b11fa07829c453f7a2ed118b572992bf480de8b5f70bac0ed6709af`.
Implementation-file hash inventory and final receipts accompany this report as JSON.

Source review confirms canonical parser/resolver/cache/settings owners, a small reusable host-free
consent policy, existing controls/localization, live permission/async epoch fences and owning-document
rendering. C14 structural refactoring remains paused. New/affected production functions and module
headers have meaningful TSDoc; no plugin-global escape hatch, new production network service,
dependency, CSS, persistent cache schema or instrumentation was introduced. The temporary plan-only
`docs/agent-handoffs/issue-127.md` is removed in the working diff. PR #137 is being finalized on the existing branch under maintainer authorization. No plugin release is requested.

## Maintainer acceptance and remaining evidence limits

On 2026-10-11 the maintainer confirmed: “I confirm tests are successful.” The maintainer then
authorized commit, push, PR completion, merge, switching to main and fetching, and explicitly
authorized resolving any merge conflicts. This accepts the manual-validation outcome; detailed
device/OS/individual test traces were not supplied. The previously reported full-verification
launcher and source-startup failures remain recorded as failures. Publication/merge authorization
does not turn those checks green. No further manual test is requested for this handoff.

For future physical Android/iOS regression coverage, the recommended check remains: in a disposable
vault, display local imagery and a controlled remote thumbnail with consent off → on → off, navigate
and hover/long-press where applicable, then reload. Expect local imagery throughout, remote loading
only during explicit opt-in and preserved consent after reload. Desktop/iframe/native popout evidence
does not establish physical WebView, touch or actual paint behavior.

## Current main integration before publication

Implementation commit `30e480484cc54d341dbc13ffca44a31ba67759f4` was integrated with `main@1b0ac271e380aa715d0fd5e93521c16ab937d85e` (PR #136 arrow direction).
Conflicts were limited to HANDOFF's current assignment and native-driver entries in package.json;
the standing header, current accepted PR #137 handoff, and both drivers are retained. GraphIndex
and indexing tests merged cleanly; source review preserves both features' changes.

The combined tree passes architecture **7**/zero violations, core **92**/restricted typecheck,
official lint, actual production build, focused consent/settings **32**, and the indexing fixture
plus **24** settings-independence scenarios. The first indexing run under parallel build/check
load failed its unchanged URL-heavy timer assertion at **84.3 ms**; a serial rerun passed.
No bound or test was changed. Previously reported full-gate failures remain recorded.

Exact rebuilt artifacts were staged separately in the same disposable vault with configuration
and workspace preservation. Native consent revalidation passes **5/5** with no captured JS errors
and cleanup confirmed. Combined runtime source inventory SHA256: `2ac330d5b4a706d4b9fbcd6a01e0d6672e2a39a03a25b24ef2f950855eb9c7e4`.
Combined main.js SHA256: `a7ef4efef7707c24b05b5d137d0db16c96646cbf9878cf1817c56a41f6ab0258`. CSS/manifest hashes are unchanged.
The JSON `mainIntegration` section holds current file identities, native receipt and staging
receipt; earlier sections remain evidence for the pre-integration build the maintainer tested.
