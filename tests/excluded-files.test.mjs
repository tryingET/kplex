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

const bundle = await contributorBrowserBundle(['src/index/GraphIndex.ts', 'src/index/IndexSnapshot.ts',
  'src/adapters/obsidian/excludedFiles.ts', 'src/adapters/obsidian/ontologySourceCollector.ts']);

/** Obsidian's MetadataCache.updateUserIgnoreFilters/isUserIgnored, reduced to its compiled form. */
function userIgnore(filters) {
  const compiled = filters.map(filter => filter.length > 2 && filter.startsWith('/') && filter.endsWith('/')
    ? new RegExp(filter.slice(1, -1), 'i') : new RegExp('^' + filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  return path => compiled.some(filter => filter.test(path));
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
  const metadataCache = { ...events, isUserIgnored: userIgnore(filters),
    getFileCache: f => ({ frontmatter: {}, hostTags: tags.get(f.path) ?? [] }),
    getFirstLinkpathDest: (link) => files.get(link) ?? files.get(`${link}.md`) ?? null,
    resolvedLinks: { 'Notes/A.md': { 'Notes/B.md': 1, 'Archive/Old.md': 1, 'Notes/Secret.md': 1 }, 'Archive/Old.md': { 'Notes/A.md': 1 }, 'Notes/B.md': {} },
    unresolvedLinks: { 'Notes/A.md': { Missing: 1 }, 'Archive/Old.md': { Gone: 1 } } };
  const app = { saveLocalStorage() {}, metadataCache, vault: { ...events, getName: () => 'excluded-files',
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
    remapNavigationPaths: () => false, scheduleRebuild: record('rebuild'), scheduleVisibleMetadataRefresh() {},
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
  assert.deepEqual(effects, [['index.invalidateHostStructure'], ['rebuild', 'vault:excluded-boundary'], ['index.invalidateHostStructure'], ['rebuild', 'vault:excluded-boundary']],
    'no path remap into or out of the exclusion');
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
  assert.deepEqual(effects, [['index.invalidateHostStructure'], ['index.updateHostFileAvailability', 'Notes/B.md']]);
  assert.equal(host.preRestoreChanged, true, 'the move still marks a structural change for restore');
});

test('Given an excluded note in the editor, when K-Plex decides whether to follow it, then it does not center on it', () => {
  const { host, deps, old } = listenerHost();
  assert.equal(productionMethod('shouldFollowDocumentFile', deps).call(host, old), false);
});

test('Given an excluded last center or history entry, when startup seeds the Plex, then only included notes are seeds', () => {
  const { host, deps, a, old } = listenerHost();
  Object.assign(host, {
    settings: { lastActivePath: old.path, navigationHistory: ['Notes/B.md', 'Archive/Old.md', 'Notes/Secret.md'], pinnedNodes: ['Notes/Secret.md', 'folder:Notes'] },
    findRecentDocumentLeaf: () => null, fileForLeaf: () => null,
  });
  host.app.workspace = { getActiveFile: () => a };
  assert.deepEqual(productionMethod('startupGraphSeedPaths', deps).call(host), ['Notes/A.md', 'Notes/B.md', 'folder:Notes']);
});

test('Given web-link owners persisted for notes that are excluded now, when the cache is restored, then they are dropped', async () => {
  const { M, app, advance } = fixture();
  const settings = { indexingMode: 'on-demand', hierarchy: { hidden: [], parents: [], children: [], leftFriends: [], rightFriends: [], previous: [], next: [], exclusions: [] },
    inferAllLinksAsFriends: false, inverseInfer: false, showFullTagName: true, tagStyleList: [], baseNodeStyle: { maxLabelLength: 30 }, maxItemCount: 30,
    pinnedNodes: [], excludeFilepaths: [], nameFields: '', noteTypeField: 'Type', primaryTagField: 'Style' };
  const index = new M.GraphIndex({ app, settings, getIndexSourceRevision: () => 0 }, app);
  const deleted = [];
  const owner = path => ({ path, mtime: 1, size: 100, version: 3, parserVersion: 3, frontmatter: {}, urls: [], inlineFieldOccurrences: [] });
  Object.assign(index.indexedDb, { open: async () => ({}), purgeAndClose: async () => true, deleteUrlOwner: async path => { deleted.push(path); return true; },
    readUrlOwners: async visit => { await visit([owner('Archive/Old.md'), owner('Notes/A.md')]); return true; } });
  try {
    let settled = false;
    index.restoreUrlIndex().then(() => { settled = true; });
    for (let step = 0; step < 400 && !settled; step++) await advance(50);
    assert.equal(settled, true);
    assert.deepEqual(deleted, ['Archive/Old.md'], 'the persisted owner of the excluded note is deleted');
    assert.equal(index.urlOwners.has('Archive/Old.md'), false);
    assert.equal(index.urlOwners.has('Notes/A.md'), true, 'included owners are restored as before');
  } finally { index.destroy(); }
});
