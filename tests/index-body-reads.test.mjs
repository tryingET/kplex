/**
 * Index body reads must not fill Obsidian's in-memory content cache. Vault.read/cachedRead keep
 * the text of each Markdown file up to 64K characters until Obsidian replaces or drops the entry or
 * the TFile goes away, so a whole-vault scan through them leaves the vault's text live. Runs the real GraphIndex web-link scan
 * against a host double whose Vault cache reads fail loudly; storage acquisition is stubbed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { contributorBrowserBundle } from './support/contributorBrowserFixture.mjs';
import { loadPortableModules } from './support/portableTypeScript.mjs';

const bundle = await contributorBrowserBundle(['src/index/GraphIndex.ts', 'src/index/IndexSnapshot.ts']);
const { exports: { readMarkdownBodyForIndex } } = loadPortableModules(['src/adapters/obsidian/markdownBodyRead.ts']);

const BODY_TEXT = '# Linked\nPlain body text.';

/** Real GraphIndex in a bounded virtual-timer realm; host reads are recorded per API. */
function fixture() {
  let clock = 0, token = 0;
  const timers = new Map(), reads = { adapter: [], vault: [] };
  const settle = async () => { for (let n = 0; n < 100; n++) await Promise.resolve(); };
  const window = { crypto: webcrypto, performance: { now: () => 0 },
    setTimeout(callback, delay = 0) { const id = ++token; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const context = vm.createContext({ window, performance: window.performance, structuredClone, URL, TextEncoder, TextDecoder,
    Date: class extends Date { static now() { return clock; } }, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(bundle, context);
  const M = window.sourceModules, file = new window.ContributorFile('Linked.md'), root = new window.ContributorFolder();
  root.children = [file]; file.parent = root;
  const files = [file], events = { on: () => ({}), offref() {} };
  const vaultCacheRead = async read => { reads.vault.push(read.path); throw new Error('Index reads must not fill Obsidian\'s content cache'); };
  const app = { saveLocalStorage() {}, vault: { ...events, getName: () => 'body-reads', getFileByPath: path => files.find(f => f.path === path) ?? null,
    getMarkdownFiles: () => files, getFiles: () => files, getRoot: () => root, getFolderByPath: path => path === '' ? root : null,
    read: vaultCacheRead, cachedRead: vaultCacheRead,
    adapter: { read: async path => { reads.adapter.push(path); return `\uFEFF${BODY_TEXT}`; } } },
  metadataCache: { ...events, getFileCache: () => ({ frontmatter: {} }), resolvedLinks: {}, unresolvedLinks: {} } };
  const settings = { indexingMode: 'on-demand', hierarchy: { hidden: [], parents: [], children: [], leftFriends: [], rightFriends: [], previous: [], next: [], exclusions: [] },
    inferAllLinksAsFriends: false, inverseInfer: false, showFullTagName: true, tagStyleList: [], baseNodeStyle: { maxLabelLength: 30 }, maxItemCount: 30,
    pinnedNodes: [], excludeFilepaths: [], nameFields: '', noteTypeField: 'Type', primaryTagField: 'Style' };
  const index = new M.GraphIndex({ app, settings, getIndexSourceRevision: () => 0 }, app);
  index.indexedDb.open = async () => ({});
  index.indexedDb.readSnapshotCatalog = async () => ({ available: false, active: null, checkpoint: null, invalidActive: false, invalidCheckpoint: false });
  index.indexedDb.readIndexDiagnostics = async () => [];
  index.indexedDb.sources.headPage = async () => ({ available: false, heads: [], next: null, invalid: 0 });
  index.indexedDb.readUrlOwners = async () => ({ available: false, owners: [] });
  index.indexedDb.getBodies = async () => new Map();
  index.indexedDb.putBodies = async () => true;
  index.indexedDb.putUrlOwners = async () => true;
  index.indexedDb.purgeAndClose = async () => true;
  const advance = async delta => {
    const end = clock + delta; let count = 0;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert(++count < 10000, 'Virtual timer processing remains bounded');
      clock = next[1].at; timers.delete(next[0]); next[1].callback(); await settle();
    }
    clock = end; await settle();
  };
  const parsed = [], parse = index.metadataParser.parse.bind(index.metadataParser);
  index.metadataParser.parse = async (content, ...rest) => { parsed.push(content); return parse(content, ...rest); };
  return { index, file, reads, parsed, advance };
}

test('index body read uses the data adapter and drops a byte-order mark like Vault.read', async () => {
  const paths = [];
  const text = await readMarkdownBodyForIndex({ read: async path => { paths.push(path); return '\uFEFF# Title\nBody'; } }, { path: 'Folder/Note.md' });
  assert.equal(text, '# Title\nBody');
  assert.deepEqual(paths, ['Folder/Note.md']);
  assert.equal(await readMarkdownBodyForIndex({ read: async () => 'No mark' }, { path: 'Plain.md' }), 'No mark');
});

test('Given a whole-vault web-link scan, when it reads note bodies, then Obsidian\'s content cache is never filled', async () => {
  const { index, file, reads, parsed, advance } = fixture();
  try {
    let settled = false, completed;
    index.startBackgroundUrlIndex().then(value => { settled = true; completed = value; });
    for (let step = 0; step < 400 && !settled; step++) await advance(50);
    assert.equal(settled, true, 'the scan settles under virtual time');
    assert.deepEqual(reads.vault, [], 'no Vault.read/cachedRead during indexing');
    assert.deepEqual(reads.adapter, [file.path], 'the body is read once through the data adapter');
    assert.equal(completed, true);
    assert.deepEqual(parsed, [BODY_TEXT], 'the parser receives the adapter text without its byte-order mark');
    assert.equal(index.urlOwners.get(file.path)?.file, file, 'the scan records the note as a current owner');
  } finally { index.destroy(); }
});
