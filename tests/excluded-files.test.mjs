/**
 * Obsidian's "Excluded files" are invisible to K-Plex, as in Obsidian's own graph view: no nodes,
 * no file-tree/tag/link facts, no ontology references (and no placeholders) to them, no body reads,
 * and the snapshot inventory/signature agree with the scans. Runs the real adapter collectors,
 * snapshot inventory and GraphIndex web-link scan in a bounded realm; only the host is doubled.
 * The ignore-filter double compiles filters exactly like Obsidian (plain filters are
 * case-insensitive path prefixes, `/…/` filters are regular expressions).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { contributorBrowserBundle } from './support/contributorBrowserFixture.mjs';
import { urlPublicationFixture } from './support/urlPublicationFixture.mjs';

const bundle = await contributorBrowserBundle(['src/index/GraphIndex.ts', 'src/index/GraphState.ts', 'src/index/IndexSnapshot.ts',
  'src/adapters/obsidian/excludedFiles.ts', 'src/adapters/obsidian/ontologySourceCollector.ts', 'src/index/IndexedDbCache.ts']);

/** Obsidian's MetadataCache.updateUserIgnoreFilters/isUserIgnored, reduced to its compiled form. */
function userIgnore(filters) {
  const compiled = filters.map(filter => filter.length > 2 && filter.startsWith('/') && filter.endsWith('/')
    ? new RegExp(filter.slice(1, -1), 'i') : new RegExp('^' + filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  return path => compiled.some(filter => filter.test(path));
}

/** Change Obsidian's excluded-files list as updateUserIgnoreFilters does: the filter and its JSON text. */
function setFilters(metadataCache, filters) {
  metadataCache.isUserIgnored = userIgnore(filters);
  metadataCache.userIgnoreFiltersString = JSON.stringify(filters);
}

/**
 * A small vault: Notes/A.md links to Notes/B.md, Archive/Old.md and Notes/Secret.md; Archive/ and
 * Notes/Secret.md are excluded. Every host read is recorded.
 */
function fixture(filters = ['Archive/', 'Notes/Secret.md']) {
  let clock = 0, token = 0;
  const timers = new Map(), reads = [];
  const settle = async () => { for (let n = 0; n < 100; n++) await Promise.resolve(); };
  const window = { crypto: webcrypto, performance: { now: () => 0 },
    setTimeout(callback, delay = 0) { const id = ++token; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const context = vm.createContext({ window, performance: window.performance, structuredClone, URL, TextEncoder, TextDecoder,
    Date: class extends Date { static now() { return clock; } }, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(bundle, context);
  const M = window.sourceModules, File = window.ContributorFile, Folder = window.ContributorFolder;
  const root = new Folder(), folders = new Map([['', root]]), files = new Map();
  const folder = (path, parent = root) => { const f = new Folder(); f.path = path; f.name = path.split('/').pop(); f.parent = parent; parent.children.push(f); folders.set(path, f); return f; };
  const file = (path, parent) => { const f = new File(path); f.parent = parent; parent.children.push(f); files.set(path, f); return f; };
  const notes = folder('Notes'), archive = folder('Archive'), nested = folder('Archive/Deep', archive);
  const a = file('Notes/A.md', notes), b = file('Notes/B.md', notes), secret = file('Notes/Secret.md', notes);
  const old = file('Archive/Old.md', archive), deep = file('Archive/Deep/Image.png', nested);
  const tags = new Map([['Notes/A.md', ['#kept']], ['Archive/Old.md', ['#archived']], ['Notes/Secret.md', ['#secret']]]);
  const events = { on: () => ({}), offref() {} };
  const metadataCache = { ...events, isUserIgnored: userIgnore(filters), userIgnoreFiltersString: JSON.stringify(filters),
    getFileCache: f => ({ frontmatter: {}, hostTags: tags.get(f.path) ?? [] }),
    getFirstLinkpathDest: (link) => files.get(link) ?? files.get(`${link}.md`) ?? null,
    resolvedLinks: { 'Notes/A.md': { 'Notes/B.md': 1, 'Archive/Old.md': 1, 'Notes/Secret.md': 1 }, 'Archive/Old.md': { 'Notes/A.md': 1 }, 'Notes/B.md': {} },
    unresolvedLinks: { 'Notes/A.md': { Missing: 1 }, 'Archive/Old.md': { Gone: 1 } } };
  const app = { saveLocalStorage() {}, metadataCache, internalPlugins: { getPluginById: () => null }, metadataTypeManager: { getPropertyInfo: () => ({ widget: 'text' }) },
    vault: { ...events, getName: () => 'excluded-files',
    getRoot: () => root, getFileByPath: path => files.get(path) ?? null, getFolderByPath: path => folders.get(path) ?? null,
    getMarkdownFiles: () => [...files.values()].filter(f => f.extension === 'md'), getFiles: () => [...files.values()],
    cachedRead: async f => { reads.push(f.path); return `Body of ${f.path}`; },
    adapter: { read: async path => { reads.push(path); return `Body of ${path}`; } } } };
  const advance = async delta => {
    const end = clock + delta; let count = 0;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((x, y) => x[1].at - y[1].at)[0];
      if (!next) break;
      assert(++count < 10000, 'Virtual timer processing remains bounded');
      clock = next[1].at; timers.delete(next[0]); next[1].callback(); await settle();
    }
    clock = end; await settle();
  };
  return { M, app, metadataCache, root, files, reads, advance, a, b, secret, old, deep };
}

/** Collect every record of a full adapter collection and finalize it. */
async function collectAll(collector) {
  const records = [];
  assert.equal(await collector.collectBatches(batch => { records.push(...batch.records); return true; }), true);
  const final = await collector.finalize();
  assert(final, 'collection finalizes');
  records.push(...final.records);
  return records;
}

const runtime = { isCurrent: () => true, sourceRevision: () => 0, checkpoint: async () => true };
const EXCLUDED = ['Archive', 'Archive/Old.md', 'Archive/Deep', 'Archive/Deep/Image.png', 'Notes/Secret.md', '#archived', '#secret', 'archived', 'secret'];

test('excluded-file filter: plain filters are path prefixes, folders are tested with a slash, the root never; no filter API excludes nothing', () => {
  const { M, metadataCache, app } = fixture();
  assert.equal(M.isExcludedFile(metadataCache, 'Archive/Old.md'), true);
  assert.equal(M.isExcludedFile(metadataCache, 'archive/old.md'), true, 'Obsidian filters ignore case');
  assert.equal(M.isExcludedFile(metadataCache, 'Notes/A.md'), false);
  assert.equal(M.isExcludedFolder(metadataCache, 'Archive'), true);
  assert.equal(M.isExcludedFolder(metadataCache, 'Archive/Deep'), true);
  assert.equal(M.isExcludedFolder(metadataCache, 'Notes'), false);
  assert.equal(M.isExcludedFolder(metadataCache, ''), false);
  assert.equal(M.isExcludedFolder(metadataCache, '/'), false);
  assert.deepEqual(M.indexedMarkdownFiles(app).map(f => f.path), ['Notes/A.md', 'Notes/B.md']);
  assert.deepEqual(M.indexedFiles(app).map(f => f.path), ['Notes/A.md', 'Notes/B.md']);
  const without = { getFileCache: () => null };
  assert.equal(M.isExcludedFile(without, 'Archive/Old.md'), false);
  assert.equal(M.isExcludedFolder(without, 'Archive'), false);
});

test('Given excluded folders and files, when the vault structure is scanned, then they produce no node, file-tree or tag fact', async () => {
  const { M, app } = fixture();
  const records = await collectAll(new M.ObsidianStructuralSourceCollector(app, runtime));
  const text = JSON.stringify(records);
  for (const path of EXCLUDED) assert.equal(text.includes(`"${path}"`), false, `${path} must not appear in structural facts`);
  for (const path of ['Notes/A.md', 'Notes/B.md', 'Notes']) assert.equal(text.includes(`"${path}"`), true, `${path} stays indexed`);
  assert.equal(text.includes('kept'), true, 'tags of included notes stay');
  assert.deepEqual([...M.structuralMarkdownSourceOrder(app.vault, app.metadataCache).keys()], ['Notes/A.md', 'Notes/B.md'],
    'the source order and the indexed Markdown list agree, so eager inventory reconciliation stays exact');
});

test('Given links from and to excluded files, when host links are collected, then only included sources and resolved targets remain', async () => {
  const { M, app } = fixture();
  const records = await collectAll(new M.ObsidianHostLinkSourceCollector(app, runtime));
  const text = JSON.stringify(records);
  for (const path of ['Archive/Old.md', 'Notes/Secret.md', 'Gone']) assert.equal(text.includes(`"${path}"`), false, `${path} must not appear in host-link facts`);
  assert.equal(text.includes('"Notes/B.md"'), true, 'links between included notes stay');
  assert.equal(text.includes('"Missing"'), true, 'unresolved links of included notes stay placeholders');
});

test('Given an ontology reference to an excluded note, when it is resolved, then it is no relation rather than a placeholder', () => {
  const { M, app } = fixture();
  assert.equal(M.resolveObsidianReferenceTarget(app, 'Notes/A.md', { rawTarget: 'Archive/Old', external: false }), null);
  assert.equal(M.resolveObsidianReferenceTarget(app, 'Notes/A.md', { rawTarget: 'Notes/Secret', external: false }), null);
  assert.equal(M.resolveObsidianReferenceTarget(app, 'Notes/A.md', { rawTarget: 'Notes/B', external: false })?.entity.physicalPath, 'Notes/B.md');
  assert.equal(M.resolveObsidianReferenceTarget(app, 'Notes/A.md', { rawTarget: 'Missing', external: false })?.entity.kind, 'unresolved',
    'a genuinely missing note still becomes a placeholder');
});

test('Given excluded files, when the vault inventory is captured, then it leaves them out and a filter change changes the signature', () => {
  const excluded = fixture(), included = fixture([]);
  const inventory = excluded.M.captureVaultInventory(excluded.app);
  assert.deepEqual([...inventory.filesByPath.keys()].sort(), ['Notes/A.md', 'Notes/B.md']);
  assert.deepEqual([...inventory.folderPaths].sort(), ['', 'Notes']);
  assert.notEqual(excluded.M.computeVaultSignature(excluded.app), included.M.computeVaultSignature(included.app),
    'editing the excluded-files list invalidates a persisted snapshot');
});

test('Given excluded notes, when the web-link scan runs, then their bodies are never read', async () => {
  const { M, app, reads, advance } = fixture();
  const settings = { indexingMode: 'on-demand', hierarchy: { hidden: [], parents: [], children: [], leftFriends: [], rightFriends: [], previous: [], next: [], exclusions: [] },
    inferAllLinksAsFriends: false, inverseInfer: false, showFullTagName: true, tagStyleList: [], baseNodeStyle: { maxLabelLength: 30 }, maxItemCount: 30,
    pinnedNodes: [], excludeFilepaths: [], nameFields: '', noteTypeField: 'Type', primaryTagField: 'Style' };
  const index = new M.GraphIndex({ app, settings, getIndexSourceRevision: () => 0 }, app);
  for (const [name, value] of Object.entries({ open: async () => ({}), readIndexDiagnostics: async () => [], getBodies: async () => new Map(),
    putBodies: async () => true, putUrlOwners: async () => true, purgeAndClose: async () => true,
    readUrlOwners: async () => ({ available: false, owners: [] }),
    readSnapshotCatalog: async () => ({ available: false, active: null, checkpoint: null, invalidActive: false, invalidCheckpoint: false }) })) index.indexedDb[name] = value;
  index.indexedDb.sources.headPage = async () => ({ available: false, heads: [], next: null, invalid: 0 });
  try {
    let settled = false;
    index.startBackgroundUrlIndex().then(() => { settled = true; });
    for (let step = 0; step < 400 && !settled; step++) await advance(50);
    assert.equal(settled, true);
    assert.deepEqual(reads.sort(), ['Notes/A.md', 'Notes/B.md']);
  } finally { index.destroy(); }
});

/** Compile one production method from main.ts; supplied dependencies shadow host globals. */
function productionMethod(name, dependencies) {
  const path = 'src/main.ts';
  const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let expression;
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) expression = `function ${name}${node.getText(source).slice(node.getText(source).indexOf('('))}`;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert(expression, `${path} must define ${name}`);
  const output = ts.transpileModule(`const selected = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(dependencies), `${output}\nreturn selected;`)(...Object.values(dependencies));
}

/** Plugin double for the real vault/metadata listeners; every index and rebuild effect is recorded. */
function listenerHost() {
  const { M, app, files, a, old } = fixture();
  const TFile = a.constructor, TFolder = app.vault.getRoot().constructor;
  const handlers = new Map(), effects = [];
  const on = (kind, callback) => { handlers.set(kind, callback); return kind; };
  const record = name => (...args) => { effects.push([name, ...args.map(arg => arg?.path ?? arg)]); return true; };
  const host = {
    app: { ...app, vault: { ...app.vault, on, offref: kind => handlers.delete(kind) }, metadataCache: { ...app.metadataCache, on, offref: kind => handlers.delete(kind) } },
    reactiveIndexListenersRegistered: false, cachedMarkdownFileCount: 3, indexDirtyRevision: 0, initialIndexComplete: true, rebuildTask: null,
    dirtyMarkdownPaths: new Set(), deletedMarkdownFiles: new Set(), managedCreatedPaths: new Map(), managedCreatedFiles: new Set(),
    managedMetadataWrites: new Map(), renameMetadataSuppressions: new Map(), preRestoreListenerCleanup: null, preRestoreChanged: false,
    preRestoreReasons: new Map(), preRestoreMarkdownPaths: new Map(), startupInitializing: false,
    registerEvent() {}, register() {}, pruneManagedMetadataWrites() {}, notifyIndexStatus() {}, settlePatchOnlyBacklogIfIdle() {},
    adjustCachedMarkdownFileCount: record('count'), countDeletedMarkdownFile: record('count-deleted'), hasVisibleKplexSurface: () => true,
    remapNavigationPaths: (from, to, folder) => { effects.push(['remap', from, to, folder]); return false; }, saveSettings: async () => {},
    scheduleRebuild: record('rebuild'), scheduleVisibleMetadataRefresh() {},
    syncLeafToKplexEnabled: () => { throw new Error('excluded files must be refused before sync state is read'); },
    index: new Proxy({ hasPhysicalBaseline: () => true, refreshVisiblePresentation: async () => {}, refreshVisibleHostMetadataPreviews: () => false },
      { get: (target, name) => target[name] ?? record(`index.${String(name)}`) }),
  };
  const deps = { TFile, TFolder, isExcludedFile: M.isExcludedFile, isExcludedFolder: M.isExcludedFolder };
  host.isExcludedVaultPath = productionMethod('isExcludedVaultPath', deps).bind(host);
  return { host, handlers, effects, deps, files, a, old, TFile };
}

test('Given excluded files, when they are created, edited or renamed within the exclusion, then the live index ignores them', () => {
  const { host, handlers, effects, deps, a, old, TFile } = listenerHost();
  productionMethod('registerReactiveIndexListeners', deps).call(host);
  const created = new TFile('Archive/New.md');
  handlers.get('create')(created);
  handlers.get('changed')(old);
  const moved = new TFile('Archive/Deep/Moved.md');
  handlers.get('rename')(moved, 'Archive/Old.md');
  handlers.get('delete')(new TFile('Archive/Gone.md'));
  assert.deepEqual(effects, [], 'no index effect, count change or rebuild for excluded files');
  assert.equal(host.dirtyMarkdownPaths.size, 0);
  handlers.get('changed')(a);
  assert.deepEqual(effects, [['rebuild', 'metadata:changed']], 'included notes keep the incremental path');
});

test('Given a note moved into or out of the excluded files, when it is renamed, then one structural refresh replaces the old state', () => {
  const { host, handlers, effects, deps, TFile } = listenerHost();
  productionMethod('registerReactiveIndexListeners', deps).call(host);
  host.dirtyMarkdownPaths.add('Notes/B.md');
  handlers.get('rename')(new TFile('Archive/B.md'), 'Notes/B.md');
  handlers.get('rename')(new TFile('Notes/Restored.md'), 'Archive/Old.md');
  assert.deepEqual(effects, [['index.invalidateHostStructure'], ['index.updateHostFileAvailability', 'Notes/B.md'], ['index.updateHostFileAvailability', 'Archive/B.md', undefined],
    ['remap', 'Notes/B.md', 'Archive/B.md', false], ['rebuild', 'vault:excluded-boundary'],
    ['index.invalidateHostStructure'], ['index.updateHostFileAvailability', 'Archive/Old.md'], ['index.updateHostFileAvailability', 'Notes/Restored.md', 'Notes/Restored.md'],
    ['remap', 'Archive/Old.md', 'Notes/Restored.md', false], ['rebuild', 'vault:excluded-boundary']],
    'Find drops or gains the file at once; no index path remap across the exclusion, but persisted navigation follows the file');
  assert.equal(host.dirtyMarkdownPaths.has('Notes/B.md'), false);
  assert.equal(host.cachedMarkdownFileCount, null, 'the indexed-note total is recounted');
});

test('Given the pre-restore fence, when excluded files change, then nothing is marked and a move into the exclusion is a catalog removal', () => {
  const { host, handlers, effects, deps, TFile } = listenerHost();
  productionMethod('installPreRestoreChangeFence', deps).call(host);
  handlers.get('create')(new TFile('Archive/New.md'));
  handlers.get('changed')(host.app.vault.getFileByPath('Archive/Old.md'));
  assert.equal(host.preRestoreChanged, false);
  assert.deepEqual(effects, []);
  handlers.get('rename')(new TFile('Archive/B.md'), 'Notes/B.md');
  assert.deepEqual(effects.filter(([name]) => name.startsWith('index.')), [['index.invalidateHostStructure'], ['index.updateHostFileAvailability', 'Notes/B.md']]);
  assert.equal(host.preRestoreChanged, true, 'the move still marks a structural change for restore');
});

test('Given an excluded note in the editor, when K-Plex decides whether to follow it, then it does not center on it', () => {
  const { host, deps, old } = listenerHost();
  assert.equal(productionMethod('shouldFollowDocumentFile', deps).call(host, old), false);
});

test('Given an excluded last center or history entry, when startup seeds the Plex, then only included notes are seeds', () => {
  const { host, deps, a, old } = listenerHost();
  Object.assign(host, {
    settings: { lastActivePath: 'folder:Archive', navigationHistory: ['Notes/B.md', 'Archive/Old.md', 'Notes/Secret.md', 'folder:Archive/Deep'],
      pinnedNodes: ['Notes/Secret.md', old.path, 'folder:Notes', '#archived', 'Archive/Missing'] },
    findRecentDocumentLeaf: () => null, fileForLeaf: () => null,
  });
  host.app.workspace = { getActiveFile: () => a };
  assert.deepEqual(productionMethod('startupGraphSeedPaths', { ...deps, isExcludedNodePath: fixture().M.isExcludedNodePath }).call(host),
    ['Notes/A.md', 'Notes/B.md', 'folder:Notes', '#archived', 'Archive/Missing'],
    'excluded notes and folder nodes are no seeds; tags and unresolved names are not vault files');
});

test('Given a folder-only filter, when files below it are listed, then the subtree is excluded like the structural walk prunes it', async () => {
  const { M, app } = fixture(['/^Archive\\/$/']);
  assert.equal(M.isExcludedFolder(app.metadataCache, 'Archive'), true);
  assert.equal(M.isExcludedFile(app.metadataCache, 'Archive/Old.md'), true, 'an excluded folder excludes everything inside it');
  assert.equal(M.isExcludedFolder(app.metadataCache, 'Archive/Deep'), true);
  assert.deepEqual(M.indexedMarkdownFiles(app).map(f => f.path), ['Notes/A.md', 'Notes/B.md', 'Notes/Secret.md']);
  assert.deepEqual([...M.structuralMarkdownSourceOrder(app.vault, app.metadataCache).keys()].sort(), M.indexedMarkdownFiles(app).map(f => f.path).sort(),
    'eager inventory sees the same Markdown set from the walk and from the file list');
  const records = await collectAll(new M.ObsidianStructuralSourceCollector(app, runtime));
  assert.equal(JSON.stringify(records).includes('"Archive/Old.md"'), false);
});

test('Given a web-link scan that is reading a note, when the note joins the excluded files, then it never publishes or persists', async () => {
  const f = urlPublicationFixture(bundle);
  const { app } = f.index;
  f.add('Archive/Old.md'); f.add('Notes/B.md');
  let release, excluded = false;
  const held = new Promise(resolve => { release = resolve; });
  const text = path => `See https://example.com/${path === 'Archive/Old.md' ? 'old' : 'b'}`;
  /** Hold the body read of Archive/Old.md until the test releases it; serve B at once. */
  const read = path => path === 'Archive/Old.md' ? held.then(() => text(path)) : Promise.resolve(text(path));
  app.vault.cachedRead = file => read(file.path);
  app.vault.adapter = { read };
  app.metadataCache.isUserIgnored = path => excluded && path.startsWith('Archive/');
  const stored = [];
  Object.assign(f.index.indexedDb, { deleteUrlOwner: async () => true,
    putUrlOwners: async records => { stored.push(...records.map(record => record.path)); return true; } });
  const hostTurn = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    const scan = Promise.all(['Archive/Old.md', 'Notes/B.md'].map(path => f.index.refreshUrlOwner(path, false)));
    for (let turn = 0; turn < 200 && !f.index.urlOwners.has('Notes/B.md'); turn++) await hostTurn();
    assert.equal(f.index.urlOwners.has('Notes/B.md'), true, 'control: an included note publishes its web links');
    assert(f.index.urlOwnerTasks.has('Archive/Old.md'), 'the read of Archive/Old.md is still in flight');
    excluded = true;
    release();
    await scan;
    for (let turn = 0; turn < 200 && f.index.urlOwnerTasks.size; turn++) await hostTurn();
    assert.equal(f.index.urlOwners.has('Archive/Old.md'), false, 'the excluded note has no web-link owner');
    assert.deepEqual(stored, ['Notes/B.md'], 'only the included owner is persisted');
    const urls = JSON.stringify([...f.index.urlState.pages.keys()]);
    assert(urls.includes('example.com/b'), 'control: the included URL is published');
    assert.equal(urls.includes('example.com/old'), false, 'the excluded note\'s URL is not published');
  } finally { f.close(); }
});

test('Given a folder rename that moves a descendant into the exclusion, when the descendant event follows, then Find drops it at its new path and the Plex refreshes', () => {
  const { host, handlers, effects, deps, TFile } = listenerHost();
  host.app.metadataCache.isUserIgnored = userIgnore(['Projects/Secret.md']);
  productionMethod('registerReactiveIndexListeners', deps).call(host);
  // Obsidian reports the folder first (its descendants already carry the new path), then each descendant.
  handlers.get('rename')(new TFile('Projects/Secret.md'), 'Drafts/Secret.md');
  assert.deepEqual(effects.filter(([name]) => name === 'index.updateHostFileAvailability'),
    [['index.updateHostFileAvailability', 'Drafts/Secret.md'], ['index.updateHostFileAvailability', 'Projects/Secret.md', undefined]],
    'the descendant leaves Find at its old and its new path');
  assert.deepEqual(effects.filter(([name]) => name === 'rebuild'), [['rebuild', 'vault:excluded-boundary']]);
});

test('Given the index cache epoch, when the list is unchanged, set for the first time or changed, then only a different list discards the cache', () => {
  const { M } = fixture();
  const storage = new Map();
  const host = list => ({ metadataCache: { isUserIgnored: () => false, userIgnoreFiltersString: JSON.stringify(list) },
    loadLocalStorage: key => storage.has(key) ? storage.get(key) : null, saveLocalStorage: (key, value) => storage.set(key, value) });
  assert.equal(M.indexCacheExclusionEpoch(host([])).matches(), true, 'nothing recorded and no list: the existing cache is kept');
  assert.equal(M.indexCacheExclusionEpoch(host(['Archive/'])).matches(), false, 'nothing recorded and a list: a cache from before the list is discarded');
  M.indexCacheExclusionEpoch(host(['Archive/'])).adopt();
  assert.equal(M.indexCacheExclusionEpoch(host(['Archive/'])).matches(), true, 'the same list keeps the cache');
  assert.equal(M.indexCacheExclusionEpoch(host(['Archive/', 'Notes/Secret.md'])).matches(), false, 'another list discards it');
  M.indexCacheExclusionEpoch(host(['Archive/'])).invalidate();
  assert.equal(M.indexCacheExclusionEpoch(host(['Archive/'])).matches(), false, 'an in-session change discards it at the next start, also if changed back');
  assert.equal(M.indexCacheExclusionEpoch({ metadataCache: {}, loadLocalStorage() { return null; }, saveLocalStorage() {} }), null, 'no filter API: no epoch');
  assert.equal(M.indexCacheExclusionEpoch({ metadataCache: { isUserIgnored: () => false } }), null, 'no vault-local storage: no epoch');
});

test('Given Obsidian reports changed settings, when the excluded-files list is among them, then the observer runs only for it', () => {
  const { M } = fixture();
  const listeners = [];
  const vault = { on: (name, callback) => { listeners.push([name, callback]); return { name }; } };
  let calls = 0;
  M.onExcludedFilesListChanged(vault, () => { calls += 1; });
  assert.deepEqual(listeners.map(([name]) => name), ['config-changed']);
  listeners[0][1]('attachmentFolderPath');
  listeners[0][1]('userIgnoreFilters');
  assert.equal(calls, 1);
});

test('Given a requested center read, when the note is excluded or joins the list during the read, then its body is never parsed or cached', async () => {
  const { M, app, metadataCache, reads, files } = fixture();
  const parsed = [], queued = [];
  const acquisition = new M.ObsidianSourceAcquisition(app, new M.KplexIndexedDbCache('requested-read'),
    async text => { parsed.push(text); return { urls: [], inlineFields: {}, inlineFieldOccurrences: [] }; });
  acquisition.cache.queueBodyWrite = path => { queued.push(path); };
  assert.equal(await acquisition.readRequestedBody(files.get('Archive/Old.md'), () => true), null);
  assert.deepEqual(reads, [], 'an excluded center is never read');
  let release;
  const held = new Promise(resolve => { release = resolve; });
  /** Hold the body read of Notes/B.md until the list has changed. */
  const read = async path => { reads.push(path); if (path === 'Notes/B.md') await held; return `Body of ${path}`; };
  app.vault.cachedRead = file => read(file.path); app.vault.read = file => read(file.path); app.vault.adapter.read = read;
  const pending = acquisition.readRequestedBody(files.get('Notes/B.md'), () => true);
  for (let turn = 0; turn < 50 && !reads.includes('Notes/B.md'); turn++) await new Promise(resolve => setImmediate(resolve));
  assert(reads.includes('Notes/B.md'), 'the read is in flight');
  setFilters(metadataCache, ['Archive/', 'Notes/Secret.md', 'Notes/B.md']);
  release();
  assert.equal(await pending, null, 'a note that joins the list mid-read yields no body');
  assert.deepEqual([parsed, queued], [[], []], 'nothing parsed or queued for the cache');
  assert.notEqual(await acquisition.readRequestedBody(files.get('Notes/A.md'), () => true), null, 'control: an included center is read');
  assert.deepEqual(queued, ['Notes/A.md']);
});

test('Given a folder rename whose descendant moves into the exclusion, when the asynchronous remap finishes after the boundary event, then the descendant stays out of Find and tags', async () => {
  const { M, app, advance, files } = fixture(['Archive/', 'Docs/Secret.md']);
  const settings = { indexingMode: 'on-demand', hierarchy: { hidden: [], parents: [], children: [], leftFriends: [], rightFriends: [], previous: [], next: [], exclusions: [] },
    inferAllLinksAsFriends: false, inverseInfer: false, showFullTagName: true, tagStyleList: [], baseNodeStyle: { maxLabelLength: 30 }, maxItemCount: 30,
    pinnedNodes: [], excludeFilepaths: [], nameFields: '', noteTypeField: 'Type', primaryTagField: 'Style' };
  const notes = files.get('Notes/A.md').parent, members = ['Notes/A.md', 'Notes/B.md', 'Notes/Secret.md'].map(path => files.get(path));
  // Tags follow the file object, so they survive the rename like Obsidian's metadata does.
  const tags = new Map([[members[0], ['#kept']], [members[2], ['#secret']]]);
  app.metadataCache.getFileCache = file => ({ frontmatter: {}, hostTags: tags.get(file) ?? [] });
  const index = new M.GraphIndex({ app, settings, getIndexSourceRevision: () => 0 }, app);
  /** Drive virtual timers until the promise settles. */
  const settled = async promise => { let done = false; promise.then(() => { done = true; }); for (let i = 0; i < 400 && !done; i++) await advance(20); assert(done, 'settles'); };
  try {
    await settled(index.primePhysicalSearchCatalog());
    // Canonical pages with folder ancestry and file-tree links, which the rename's canonical pass follows.
    for (const file of members) index.insertCreatedFile(file);
    assert(index.state.pages.has('Notes/Secret.md') && index.state.pages.has('folder:Notes'), 'canonical pages exist before the rename');
    // Obsidian renames Notes → Docs: the folder event first (descendants already carry their new path).
    notes.path = 'Docs'; notes.name = 'Docs';
    for (const file of members) { files.delete(file.path); file.path = `Docs/${file.name}`; files.set(file.path, file); }
    const folderAt = app.vault.getFolderByPath;
    app.vault.getFolderByPath = path => path === 'Docs' ? notes : path === 'Notes' ? null : folderAt(path);
    // The remap yields cooperatively (after 8 ms in a large vault); model that yield before its folder pass.
    let resume;
    const yielded = new Promise(resolve => { resume = resolve; });
    const folderPass = index.updateHostFolderAvailability.bind(index);
    index.updateHostFolderAvailability = async (...args) => { await yielded; return folderPass(...args); };
    const remap = index.renameFolder('Notes', notes);
    // Meanwhile the descendant's own boundary rename runs, as main.ts handles it (removal at both paths).
    index.updateHostFileAvailability('Notes/Secret.md');
    index.updateHostFileAvailability('Docs/Secret.md');
    resume();
    await settled(remap);
    assert.equal(index.state.pages.get('Docs/Secret.md')?.file === members[2], false, 'the remap does not move the excluded descendant into the graph');
    assert.equal(index.physicalSearchEntries.has('Docs/Secret.md'), false, 'nor back into Find');
    assert.equal(index.getVaultSearchPage('Docs/Secret.md'), undefined);
    assert.equal([...(index.hostPreview.tagMembers.get('tag:secret') ?? [])].includes('Docs/Secret.md'), false, 'nor into its tag');
    assert(index.physicalSearchEntries.has('Docs/A.md'), 'control: included descendants move to their new path');
  } finally { index.destroy(); }
});

/** Fixture GraphIndex with the on-demand settings used throughout this file. */
function excludedIndex(M, app) {
  const settings = { indexingMode: 'on-demand', hierarchy: { hidden: [], parents: [], children: [], leftFriends: [], rightFriends: [], previous: [], next: [], exclusions: [] },
    inferAllLinksAsFriends: false, inverseInfer: false, showFullTagName: true, tagStyleList: [], baseNodeStyle: { maxLabelLength: 30 }, maxItemCount: 30,
    pinnedNodes: [], excludeFilepaths: [], nameFields: '', noteTypeField: 'Type', primaryTagField: 'Style' };
  return new M.GraphIndex({ app, settings, getIndexSourceRevision: () => 0 }, app);
}

test('Given a K-Plex action that creates an excluded note, when the index materializes it, then the caller gets a detached page and the Plex leaves it out', () => {
  const { M, app, files, secret, a } = fixture();
  const index = excludedIndex(M, app);
  try {
    const page = index.insertCreatedFile(secret, ['Hidden']);
    assert.equal(JSON.stringify([page.path, page.file === secret, page.aliases]), JSON.stringify(['Notes/Secret.md', true, ['Hidden']]), 'the caller can reference or open it');
    assert.equal(index.state.pages.has('Notes/Secret.md'), false, 'no graph page');
    assert.equal(index.getVaultSearchPage('Notes/Secret.md'), undefined, 'no Find result');
    assert.equal(index.state.pages.has('folder:Notes'), false, 'no ancestry is materialized for it');
    assert.equal(index.insertCreatedFile(a).path, 'Notes/A.md');
    assert(index.state.pages.has('Notes/A.md') && files.get('Notes/A.md') === a, 'control: an included note is materialized');
  } finally { index.destroy(); }
});

test('Given a retained view of a renamed folder, when its prepass remaps the views, then a descendant that moved into the exclusion is not remapped', async () => {
  const { M, app, advance, files } = fixture(['Archive/', 'Docs/Secret.md']);
  const notes = files.get('Notes/A.md').parent, members = ['Notes/A.md', 'Notes/B.md', 'Notes/Secret.md'].map(path => files.get(path));
  const index = excludedIndex(M, app);
  /** Drive virtual timers until the promise settles. */
  const settled = async promise => { let done = false, failure; promise.then(() => { done = true; }, error => { failure = error; done = true; });
    for (let i = 0; i < 400 && !done; i++) await advance(20); assert(done, 'settles'); if (failure) throw failure; };
  try {
    for (const file of members) index.insertCreatedFile(file);
    // An on-demand view of Notes/A.md retains its neighbours, the soon-excluded note among them.
    const view = M.createGraphState();
    for (const file of members) view.pages.set(file.path, index.state.pages.get(file.path));
    index.onDemandHostScopes.set('Notes/A.md', view);
    notes.path = 'Docs'; notes.name = 'Docs';
    for (const file of members) { files.delete(file.path); file.path = `Docs/${file.name}`; files.set(file.path, file); }
    const folderAt = app.vault.getFolderByPath;
    app.vault.getFolderByPath = path => path === 'Docs' ? notes : path === 'Notes' ? null : folderAt(path);
    const remap = index.renameFolder('Notes', notes);
    index.updateHostFileAvailability('Notes/Secret.md');
    index.updateHostFileAvailability('Docs/Secret.md');
    await settled(remap);
    assert.equal(index.state.pages.get('Docs/Secret.md')?.file === members[2], false, 'the excluded descendant is not remapped into the graph');
    assert.equal(index.getVaultSearchPage('Docs/Secret.md'), undefined, 'nor into Find');
    assert.equal(index.state.pages.get('Docs/A.md')?.file, members[0], 'control: included descendants move');
  } finally { index.destroy(); }
});

test('Given a prewarm or full build waiting on the body cache, when a note joins the excluded files, then it is not read, parsed or cached', async () => {
  for (const pass of ['prewarm', 'rebuild']) {
    const { M, app, metadataCache, advance, reads } = fixture();
    const index = excludedIndex(M, app);
    index.plugin.settings.indexingMode = 'eager';
    const parsed = [], cached = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    app.vault.read = async file => { reads.push(file.path); return `Body of ${file.path}`; };
    const parse = index.metadataParser.parse.bind(index.metadataParser);
    index.metadataParser.parse = (text, ...rest) => { parsed.push(text); return parse(text, ...rest); };
    Object.assign(index.indexedDb, { bodyStoreReady: async () => true, getBodies: async () => { await held; return new Map(); },
      putBodies: async records => { cached.push(...records.map(record => record.path)); return true; },
      putBody: async path => { cached.push(path); return true; }, open: async () => null });
    try {
      let done = false;
      (pass === 'prewarm' ? index.prewarmBodyCache(() => true) : index.rebuild()).then(() => { done = true; }, () => { done = true; });
      for (let i = 0; i < 50 && !done; i++) await advance(20);
      setFilters(metadataCache, ['Archive/', 'Notes/Secret.md', 'Notes/B.md']);
      release();
      for (let i = 0; i < 400 && !done; i++) await advance(20);
      assert(done, `${pass} settles`);
      assert.equal(reads.includes('Notes/B.md'), false, `${pass}: the newly excluded note is not read`);
      assert.equal(parsed.some(text => text.includes('Notes/B.md')), false, `${pass}: nor parsed`);
      assert.equal(cached.includes('Notes/B.md'), false, `${pass}: nor cached`);
    } finally { index.destroy(); }
  }
});

test('Given a body already queued for the cache, when its note joins the excluded files before the batch is written, then the batch leaves it out', async () => {
  for (const pass of ['prewarm', 'rebuild']) {
    const { M, app, metadataCache, advance, files, a } = fixture();
    // Enough notes that a batch is written mid-pass (128 bodies on desktop), after A was queued.
    for (let n = 0; n < 140; n++) {
      const note = new a.constructor(`Notes/N${String(n).padStart(3, '0')}.md`); note.parent = a.parent; a.parent.children.push(note); files.set(note.path, note);
    }
    const index = excludedIndex(M, app);
    index.plugin.settings.indexingMode = 'eager';
    const cached = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    app.vault.read = async file => `Body of ${file.path}`;
    const parse = index.metadataParser.parse.bind(index.metadataParser);
    // A's body is parsed and queued first; N010's parse waits until the list has changed.
    index.metadataParser.parse = async (text, ...rest) => { if (text.includes('Notes/N010.md')) await held; return parse(text, ...rest); };
    Object.assign(index.indexedDb, { bodyStoreReady: async () => true, getBodies: async () => new Map(),
      putBodies: async records => { cached.push(...records.map(record => record.path)); return true; },
      putBody: async path => { cached.push(path); return true; }, open: async () => null });
    try {
      let done = false;
      (pass === 'prewarm' ? index.prewarmBodyCache(() => true) : index.rebuild()).then(() => { done = true; }, () => { done = true; });
      for (let i = 0; i < 50 && !done; i++) await advance(20);
      setFilters(metadataCache, ['Archive/', 'Notes/Secret.md', 'Notes/A.md']);
      release();
      for (let i = 0; i < 400 && !done; i++) await advance(20);
      assert(done, `${pass} settles`);
      assert.equal(cached.includes('Notes/A.md'), false, `${pass}: the queued body of the newly excluded note is not written`);
    } finally { index.destroy(); }
  }
});

test('Given a prewarm at its scheduler checkpoint, when the note joins the excluded files there, then it is not parsed', async () => {
  const { M, app, metadataCache, advance } = fixture();
  const index = excludedIndex(M, app);
  const parsed = [];
  app.vault.read = async file => `Body of ${file.path}`;
  const parse = index.metadataParser.parse.bind(index.metadataParser);
  index.metadataParser.parse = (text, ...rest) => { parsed.push(text); return parse(text, ...rest); };
  Object.assign(index.indexedDb, { bodyStoreReady: async () => true, getBodies: async () => new Map(), putBodies: async () => true, open: async () => null });
  // The list changes during the checkpoint that precedes the first parse.
  const checkpoint = index.workScheduler.checkpoint.bind(index.workScheduler);
  let reads = 0, changed = false;
  // Count native reads on both paths (Vault.read, or the data adapter once index reads use it).
  const read = app.vault.read, adapterRead = app.vault.adapter.read;
  app.vault.read = async file => { reads += 1; return read(file); };
  app.vault.adapter.read = async path => { reads += 1; return adapterRead(path); };
  index.workScheduler.checkpoint = async (...args) => {
    if (reads >= 2 && !changed) { changed = true; setFilters(metadataCache, ['Archive/', 'Notes/Secret.md', 'Notes/A.md']); }
    return checkpoint(...args);
  };
  try {
    let done = false;
    index.prewarmBodyCache(() => true).then(() => { done = true; }, () => { done = true; });
    for (let i = 0; i < 400 && !done; i++) await advance(20);
    assert(done && changed, 'the prewarm ran past the change');
    assert.equal(parsed.some(text => text.includes('Notes/A.md')), false, 'the newly excluded note is not parsed');
    assert(parsed.some(text => text.includes('Notes/B.md')), 'control: the included note is parsed');
  } finally { index.destroy(); }
});

test('Given a placeholder, when K-Plex materializes it as a note on the excluded files, then nothing is promoted and the action still succeeds', () => {
  const { M, app, files, a } = fixture(['Archive/', 'Notes/NewSecret.md']);
  const index = excludedIndex(M, app);
  try {
    index.insertCreatedFile(a);
    // An unresolved placeholder, shown in a retained on-demand view, then created on the list.
    const ghost = { path: 'Notes/NewSecret', file: null, name: 'NewSecret', url: null, isFolder: false, isTag: false, mtime: null,
      aliases: [], tags: [], noteType: null, primaryStyleTag: null, styleTags: [], maxLabelLength: 0, neighbours: new Map() };
    index.state.pages.set(ghost.path, ghost);
    const view = M.createGraphState(); view.pages.set(ghost.path, ghost); view.pages.set(a.path, index.state.pages.get(a.path));
    index.onDemandHostScopes.set(a.path, view);
    const created = new a.constructor('Notes/NewSecret.md'); created.parent = a.parent; a.parent.children.push(created); files.set(created.path, created);
    assert.equal(index.materializeFile(ghost.path, created), true, 'the creation flow continues (it opens the note)');
    assert.equal([...index.state.pages.values()].some(page => page.file === created), false, 'no graph page binds the excluded note');
    assert.equal([...view.pages.values()].some(page => page.file === created), false, 'nor does the retained view');
    assert.equal(index.getVaultSearchPage('Notes/NewSecret.md'), undefined, 'no Find result');
  } finally { index.destroy(); }
});
