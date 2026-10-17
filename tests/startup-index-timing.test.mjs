/**
 * Startup timing of the once-per-session index. Runs the host-free timing policy and the actual
 * main.ts startup/demand methods (extracted from source) against bounded plugin doubles. These
 * doubles prove ordering and once-only ownership; they are not native Obsidian or device evidence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadPortableModules } from "./support/portableTypeScript.mjs";

const { exports: { startupIndexTiming, STARTUP_INDEX_IDLE_TIMEOUT_MS } } = loadPortableModules(["src/application/startupIndexTiming.ts"]);

/** Compile one production method from main.ts, keeping it sync or async as declared; dependencies shadow host globals. */
function productionFunction(path, name, dependencies) {
  const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let expression;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) {
      const async = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? "async " : "";
      expression = `${async}function ${name}${node.getText(source).slice(node.getText(source).indexOf("("))}`;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert(expression, `${path} must define ${name}`);
  const output = ts.transpileModule(`const selected = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(dependencies), `${output}\nreturn selected;`)(...Object.values(dependencies));
}

/** A bounded idle host: callbacks run only when the test says the host became idle. */
function idleWindow() {
  const pending = new Map();
  let next = 0;
  return {
    pending,
    requestIdleCallback: (callback, options) => { pending.set(++next, { callback, options }); return next; },
    cancelIdleCallback: handle => pending.delete(handle),
    setTimeout: () => 1, clearTimeout: () => {},
    becomeIdle() { const due = [...pending.values()]; pending.clear(); for (const entry of due) entry.callback(); },
  };
}

/** Plugin double with the real once-only start method and recorded host effects; `startup` holds the deferred start open. */
function plugin({ mobile, openViews = 0, visible = false, window = idleWindow(), startup = null }) {
  const calls = [], cleanup = [];
  const Platform = { isMobile: mobile };
  const startSessionIndex = productionFunction("src/main.ts", "startSessionIndex", {});
  const context = {
    calls, cleanup, window,
    unloading: false, layoutReady: true, openKplexViews: openViews, sessionIndexStart: null, sessionIndexDeferred: false, initialIndexComplete: false,
    startupDiagnostics: { mark: name => calls.push(`mark:${name}`) },
    hasVisibleKplexSurface: () => visible,
    armStartupInitializationGuard: () => calls.push("guard"),
    registerOntologyContextMenu: () => calls.push("context-menu"),
    register: callback => cleanup.push(callback),
    runSessionIndexStartup: async () => { calls.push("session-index"); await startup; },
    ensureInitialIndex: async () => { calls.push("initial-index"); },
    performRebuild: async (...args) => { calls.push(`rebuild:${args[2]}`); },
    index: { size: 0 },
  };
  context.startSessionIndex = (...args) => startSessionIndex.call(context, ...args);
  context.scheduleIdleSessionIndex = (...args) => productionFunction("src/main.ts", "scheduleIdleSessionIndex", { window, STARTUP_INDEX_IDLE_TIMEOUT_MS }).call(context, ...args);
  context.startOrDeferSessionIndex = (...args) => productionFunction("src/main.ts", "startOrDeferSessionIndex", { Platform, startupIndexTiming }).call(context, ...args);
  context.initialBuildLostDemand = (...args) => productionFunction("src/main.ts", "initialBuildLostDemand", { Platform }).call(context, ...args);
  context.joinDeferredSessionIndex = (...args) => productionFunction("src/main.ts", "joinDeferredSessionIndex", {}).call(context, ...args);
  context.rebuildIndex = (...args) => productionFunction("src/main.ts", "rebuildIndex", {}).call(context, ...args);
  context.ensureIndexReady = (...args) => productionFunction("src/main.ts", "ensureIndexReady", {}).call(context, ...args);
  return context;
}

test("timing policy: an open view starts now; otherwise desktop waits for idle and mobile for the first open", () => {
  assert.equal(startupIndexTiming({ mobile: false, viewOpen: true }), "now");
  assert.equal(startupIndexTiming({ mobile: true, viewOpen: true }), "now");
  assert.equal(startupIndexTiming({ mobile: false, viewOpen: false }), "idle");
  assert.equal(startupIndexTiming({ mobile: true, viewOpen: false }), "on-open");
});

test("Given mobile with no K-Plex view, when layout is ready, then no whole-vault index starts until a view opens", async () => {
  const kplex = plugin({ mobile: true });
  await kplex.startOrDeferSessionIndex();
  assert.deepEqual(kplex.calls, ["mark:layout-ready", "guard", "context-menu"], "layout-ready keeps its guard and editor menu, nothing else");
  assert.equal(kplex.window.pending.size, 0, "mobile never schedules an idle start");
  assert.equal(kplex.sessionIndexDeferred, true);

  kplex.openKplexViews = 1; // onKplexViewOpened() counts the view before ensureIndexReady().
  await kplex.ensureIndexReady("view-open");
  assert.deepEqual(kplex.calls.slice(3), ["session-index", "initial-index", "rebuild:view-open"],
    "the first open starts the session index before the initial index and the view rebuild");
  await kplex.ensureIndexReady("view-visible");
  assert.equal(kplex.calls.filter(call => call === "session-index").length, 1, "the session index starts once per session");
});

test("Given desktop with no K-Plex view, when the host becomes idle, then the session index starts once", async () => {
  const kplex = plugin({ mobile: false });
  await kplex.startOrDeferSessionIndex();
  assert.deepEqual(kplex.calls, ["mark:layout-ready", "guard", "context-menu"]);
  assert.equal(kplex.window.pending.size, 1, "one idle start is scheduled");
  assert.equal([...kplex.window.pending.values()][0].options.timeout, STARTUP_INDEX_IDLE_TIMEOUT_MS, "the idle wait is bounded");
  kplex.window.becomeIdle();
  await kplex.sessionIndexStart;
  assert.deepEqual(kplex.calls.slice(3), ["session-index"]);
  await kplex.ensureIndexReady("view-open");
  assert.equal(kplex.calls.filter(call => call === "session-index").length, 1, "a later open joins the idle start");
});

test("Given desktop, when the plugin unloads before idle, then the idle start is cancelled", async () => {
  const kplex = plugin({ mobile: false });
  await kplex.startOrDeferSessionIndex();
  for (const callback of kplex.cleanup) callback();
  assert.equal(kplex.window.pending.size, 0);
});

test("Given a restored open or visible K-Plex view, when layout is ready, then the session index starts immediately as before", async () => {
  for (const options of [{ mobile: true, openViews: 1 }, { mobile: true, visible: true }, { mobile: false, openViews: 1 }]) {
    const kplex = plugin(options);
    await kplex.startOrDeferSessionIndex();
    assert.deepEqual(kplex.calls, ["session-index"], JSON.stringify(options));
    assert.equal(kplex.sessionIndexDeferred, false);
    await kplex.ensureIndexReady("view-open");
    assert.deepEqual(kplex.calls, ["session-index", "initial-index", "rebuild:view-open"], "immediate startup keeps the previous view-open order");
  }
});

test("Given a deferred mobile startup, when the user explicitly rebuilds, then the session index starts first", async () => {
  const kplex = plugin({ mobile: true });
  await kplex.startOrDeferSessionIndex();
  await kplex.rebuildIndex(true, false, "direct");
  assert.deepEqual(kplex.calls.slice(3), ["session-index", "rebuild:direct"]);
});

/** A promise the test settles explicitly, to hold an await open. */
function deferred() {
  let resolve;
  const promise = new Promise(settle => { resolve = settle; });
  return { promise, resolve };
}

test("Given mobile, when the last view closes while the deferred start awaits restore, then no initial index starts; reopening starts it", async () => {
  const hold = deferred();
  const kplex = plugin({ mobile: true, startup: hold.promise });
  await kplex.startOrDeferSessionIndex();
  kplex.openKplexViews = 1;
  const opening = kplex.ensureIndexReady("view-open");
  await Promise.resolve();
  assert.deepEqual(kplex.calls.slice(3), ["session-index"], "the first open starts the deferred session index");
  kplex.openKplexViews = 0;
  hold.resolve();
  await opening;
  assert.deepEqual(kplex.calls.slice(3), ["session-index"], "no initial index or rebuild after the view closed");
  kplex.openKplexViews = 1;
  await kplex.ensureIndexReady("view-open");
  assert.deepEqual(kplex.calls.slice(3), ["session-index", "initial-index", "rebuild:view-open"], "reopening resumes without a second session start");
});

/**
 * Plugin double that runs the real startup chain down to build admission: the session start, the
 * initial index, the rebuild coordinator and the view open/close hooks all come from main.ts. The
 * index records which build it was asked for; metadata stability is held open by the test.
 */
function startupChain({ mobile, ios = false, metadataStable = Promise.resolve(), hydration = null }) {
  const calls = [], builds = [];
  const Platform = { isMobile: mobile, isIosApp: ios };
  const window = { ...idleWindow(), setTimeout: callback => { setTimeout(callback, 0); return 1; }, clearTimeout() {} };
  // Host helpers the startup methods may read; the indexed Markdown files are the vault's here.
  const dependencies = { Platform, window, startupIndexTiming, STARTUP_INDEX_IDLE_TIMEOUT_MS, KPLEX_VIEW_TYPE: "k-plex", perfNow: () => 0, Notice: class {},
    indexedMarkdownFiles: app => app.vault.getMarkdownFiles() };
  let built = false, hydrated = false;
  const context = {
    calls, builds, window,
    unloading: false, layoutReady: true, openKplexViews: 0, sessionIndexStart: null, sessionIndexDeferred: false,
    initialIndexTask: null, initialIndexComplete: false, metadataStabilized: false, metadataStabilityPromise: null,
    indexDirty: false, indexDirtyRevision: 0, indexBacklogReasons: new Set(), dirtyMarkdownPaths: new Set(),
    rebuildTask: null, rebuildTimer: null, snapshotRestoreTask: null, preRestoreListenerCleanup: null, preRestoreUncoveredChanges: false,
    settings: { sidecarOpen: false },
    app: { vault: { getMarkdownFiles: () => Array.from({ length: 6000 }) }, workspace: { getLeavesOfType: () => [] } },
    startupDiagnostics: { mark() {} }, supportEvents: { record() {} },
    hasVisibleKplexSurface: () => context.openKplexViews > 0,
    startupGraphSeedPaths: () => [],
    armStartupInitializationGuard() {}, registerOntologyContextMenu() {}, registerReactiveIndexListeners() {},
    classifyPreRestoreChanges() {}, refreshBookmarkedEntryPoints: async () => {}, notifyIndexStatus() {},
    pruneMissingDirtyMarkdownPaths() {}, scheduleRebuild: reason => calls.push(`schedule:${reason}`),
    restorePersistedSidecar: async () => {}, releaseSidecar: async () => {}, register() {},
    waitForMetadataCacheStability: () => { calls.push("metadata-wait"); return metadataStable; },
    index: {
      size: 0,
      startBackgroundUrlIndex() {}, primePhysicalSearchCatalog: async () => {},
      // `hydration` models a restored preview whose source-backed graph still hydrates; adoption follows it.
      restorePersistedSnapshot: async () => ({ restored: Boolean(hydration), fresh: false }),
      isOnDemandMode: () => false, hasPendingSnapshotHydration: () => Boolean(hydration) && !hydrated, hasIncrementalRestorePatch: () => false,
      waitForSnapshotHydration: async () => { await hydration; hydrated = true; return { restored: true, fresh: true }; },
      adoptStartupSources: async () => { builds.push("adopt-sources"); built = true; context.index.size = 1; return true; },
      hasPhysicalBaseline: () => false, hasRestoredCheckpoint: () => false, hasSourceBackedStartup: () => Boolean(hydration),
      isFullSnapshotHydrated: () => built, hasPendingStructuralMaintenance: () => false,
      noteBuildDecision: kind => builds.push(kind),
      rebuildProgressively: async () => { built = true; context.index.size = 1; return true; },
      rebuild: async () => { built = true; context.index.size = 1; return true; },
      cancelRebuild: () => calls.push("cancel"), cancelPendingPersistence() {},
    },
  };
  for (const name of ["startOrDeferSessionIndex", "startSessionIndex", "joinDeferredSessionIndex", "initialBuildLostDemand", "scheduleIdleSessionIndex",
    "runSessionIndexStartup", "finishStartupIndexPreparation", "ensureIndexReady", "ensureInitialIndex", "rebuildIndex", "performRebuild", "onKplexViewOpened", "onKplexViewClosed",
    "adoptInitialSourceIndex", "allowsStartupSourceAdoption"]) {
    const method = productionFunction("src/main.ts", name, dependencies);
    context[name] = (...args) => method.call(context, ...args);
  }
  return context;
}

/** Let pending host callbacks and promise continuations run. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

for (const ios of [true, false]) {
  test(`Given a deferred ${ios ? "iOS" : "Android"} start, when the last view closes while the initial index awaits metadata stability, then no build is admitted; reopening builds once`, async () => {
    const stable = deferred();
    const kplex = startupChain({ mobile: true, ios, metadataStable: stable.promise });
    await kplex.startOrDeferSessionIndex();
    const opening = kplex.onKplexViewOpened();
    while (!kplex.calls.includes("metadata-wait")) await settle();
    kplex.onKplexViewClosed();
    stable.resolve();
    await opening;
    for (let turn = 0; turn < 5; turn += 1) await settle();
    assert.deepEqual(kplex.builds, [], "no whole-vault build after the last view closed");
    assert.equal(kplex.initialIndexComplete, false);
    assert.equal(kplex.indexDirty, true, "the cold-start backlog stays for the next open");

    await kplex.onKplexViewOpened();
    assert.deepEqual(kplex.builds, ["cold-progressive"], "reopening builds once, progressively");
    assert.equal(kplex.initialIndexComplete, true);
  });
}

for (const ios of [true, false]) {
  test(`Given a deferred ${ios ? "iOS" : "Android"} start with durable sources, when the last view closes while the snapshot hydrates, then no source adoption starts; reopening adopts once`, async () => {
    const restore = deferred();
    const kplex = startupChain({ mobile: true, ios, hydration: restore.promise });
    await kplex.startOrDeferSessionIndex();
    const opening = kplex.onKplexViewOpened();
    for (let turn = 0; turn < 5; turn += 1) await settle();
    kplex.onKplexViewClosed();
    restore.resolve();
    await opening;
    for (let turn = 0; turn < 5; turn += 1) await settle();
    assert.deepEqual(kplex.builds, [], "no whole-vault node catalog after the last view closed");
    assert.equal(kplex.initialIndexComplete, false);
    assert.equal(kplex.allowsStartupSourceAdoption(), false, "the index's own hydration is told to defer adoption too");

    await kplex.onKplexViewOpened();
    assert.deepEqual(kplex.builds, ["adopt-sources"], "reopening adopts the durable sources once");
    assert.equal(kplex.allowsStartupSourceAdoption(), true);
    assert.equal(kplex.initialIndexComplete, true);
  });
}

test("Given desktop, when no view is open after the idle start, then the initial index still builds in the background", async () => {
  const kplex = startupChain({ mobile: false });
  await kplex.startOrDeferSessionIndex();
  assert.deepEqual(kplex.builds, [], "nothing builds before idle");
  kplex.window.becomeIdle();
  await kplex.sessionIndexStart;
  await kplex.initialIndexTask;
  assert.deepEqual(kplex.builds, ["cold-progressive"], "desktop builds at idle without a view, as before at layout-ready");
  assert.equal(kplex.initialIndexComplete, true);
});

/** Production pre-restore fence with the real navigation remapper and recorded settings saves. */
function fenceHost(settings) {
  class TFile { constructor(path) { this.path = path; this.extension = path.split(".").pop(); } }
  class TFolder { constructor(path) { this.path = path; } }
  const handlers = new Map(), saves = [];
  const on = (kind, callback) => { handlers.set(kind, callback); return kind; };
  const host = {
    settings, saves, handlers, TFile, TFolder, preRestoreListenerCleanup: null, preRestoreChanged: false, indexDirtyRevision: 0,
    preRestoreReasons: new Map(), preRestoreMarkdownPaths: new Map(), dirtyMarkdownPaths: new Set(),
    app: { vault: { on, offref: kind => handlers.delete(kind), getFileByPath: () => null }, metadataCache: { on, offref: kind => handlers.delete(kind) },
      workspace: { getLeavesOfType: () => [] } },
    documentSession: /** No K-Plex view is open before the first open. */ () => null,
    index: { invalidateHostStructure() {}, updateHostFileAvailability() {}, async updateHostFolderAvailability() {}, refreshVisibleHostMetadataPreviews: () => false, async refreshVisiblePresentation() {} },
    register() {}, scheduleVisibleMetadataRefresh() {}, saveSettings: async (...args) => { saves.push(args); },
    isExcludedVaultPath: /** No Obsidian excluded files in this fixture. */ () => false,
  };
  host.remapNavigationPaths = productionFunction("src/main.ts", "remapNavigationPaths", { KPLEX_VIEW_TYPE: "k-plex", KPLEX_SIDEPANEL_VIEW_TYPE: "k-plex-sidepanel" }).bind(host);
  productionFunction("src/main.ts", "installPreRestoreChangeFence", { TFile, TFolder }).call(host);
  return host;
}

test("Given a deferred start, when a pinned note and a folder are renamed before the first open, then center, history, pins and sidecar path follow", () => {
  const settings = { lastActivePath: "Notes/Old.md", sidecarLastFilePath: "Notes/Old.md",
    navigationHistory: ["Notes/Old.md", "Projects/Plan.md", "folder:Projects"], pinnedNodes: ["Projects/Plan.md"] };
  const host = fenceHost(settings);
  host.handlers.get("rename")(new host.TFile("Notes/New.md"), "Notes/Old.md");
  host.handlers.get("rename")(new host.TFolder("Archive/Projects"), "Projects");
  assert.deepEqual(settings, { lastActivePath: "Notes/New.md", sidecarLastFilePath: "Notes/New.md",
    navigationHistory: ["Notes/New.md", "Archive/Projects/Plan.md", "folder:Archive/Projects"], pinnedNodes: ["Archive/Projects/Plan.md"] });
  assert.equal(host.saves.length, 2, "each remap is saved");
  host.handlers.get("rename")(new host.TFile("Other/Unrelated.md"), "Other/Before.md");
  assert.equal(host.saves.length, 2, "unrelated renames do not save settings");
});
