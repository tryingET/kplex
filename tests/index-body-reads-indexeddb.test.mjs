/**
 * Every whole-vault body path reads through the data adapter, never through Vault.read/cachedRead
 * (which would keep each note's text in Obsidian's content cache). Production GraphIndex, builder,
 * source acquisition and real Chromium IndexedDB; only the host vault is doubled: its adapter serves
 * the note text and both Vault cache reads throw.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { contributorBrowserBundle, contributorBrowserInitialize } from './support/contributorBrowserFixture.mjs';
import { chromiumHarness } from './support/browserTypeScript.mjs';
import { centerGateSettings } from './support/requestedCenterGateFixture.mjs';

const bundle = await contributorBrowserBundle(['src/index/GraphIndex.ts', 'src/index/GraphBuilder.ts', 'src/index/IndexSnapshot.ts']);

const initialize = `(() => {
  window.readsFixture = async (name, mode) => {
    const f = await fixture(name); f.app.vault.getName = () => name;
    f.app.vault.getAbstractFileByPath = path => f.files.get(path) ?? (path === '/' || path === '' ? f.app.vault.getRoot() : null);
    const settings = {...(${centerGateSettings.toString()})({showFolderNodes:false,renderSiblings:false}),
      hierarchy:{hidden:[],parents:['Parent'],children:['Child'],leftFriends:['Friend'],rightFriends:[],previous:[],next:[]},
      inferAllLinksAsFriends:false,inverseInfer:false,showFullTagName:true,tagStyleList:[],indexingMode:mode,urlIndexingMode:'background',lastActivePath:'A.md',pinnedNodes:[]};
    const index = new sourceModules.GraphIndex({app:f.app,settings,getIndexSourceRevision:()=>0,
      startupDiagnostics:{mark(){},count(){},phase(){},recordWork:/** Receipts are not under test. */()=>{}}},f.app);
    index.scheduleOrphanCleanup = () => {};
    const adapterReads = [];
    f.app.vault.adapter = {read: async path => { adapterReads.push(path); return f.texts.get(path) ?? ''; }};
    f.app.vault.read = f.app.vault.cachedRead = async file => { throw new Error('Vault cache read of ' + file.path); };
    f.add('A.md', 'Child:: [[B]] and [site](https://example.com/a)');
    f.add('B.md', 'Plain body');
    return {f, index, adapterReads, close() { index.destroy(); f.close(); }};
  };
  return true;
})()`;

/** Run one browser scenario with the shared real-IndexedDB fixture. */
async function scenario(code) {
  const browser = await chromiumHarness(bundle);
  try {
    assert.equal(await browser.evaluate(contributorBrowserInitialize), true);
    assert.equal(await browser.evaluate(initialize), true);
    assert.equal(await browser.evaluate(code), true);
  } finally { await browser.cleanup(); }
}

test('Given an eager full build, when it reads note bodies, then only the data adapter is used', async () => scenario(`(async () => {
  const o = await readsFixture('reads-full-build', 'eager');
  try {
    ok(await o.index.rebuild(), 'full build completes without Vault cache reads');
    ok(o.adapterReads.includes('A.md') && o.adapterReads.includes('B.md'), 'bodies come from the adapter: ' + JSON.stringify(o.adapterReads));
  } finally { o.close(); }
  return true;
})()`));

test('Given an edited note, when the incremental patch rereads it, then only the data adapter is used', async () => scenario(`(async () => {
  const o = await readsFixture('reads-patch', 'eager');
  try {
    ok(await o.index.rebuild(), 'initial build');
    const before = o.adapterReads.filter(path => path === 'A.md').length;
    const file = o.f.files.get('A.md'); o.f.texts.set('A.md', 'Parent:: [[B]] edited'); file.stat = {...file.stat, mtime: file.stat.mtime + 1000, size: 21};
    const result = await o.index.patchMarkdownPaths(['A.md']);
    ok(result?.outcome === 'patched' && result.count === 1, 'the patch commits without Vault cache reads: ' + JSON.stringify(result));
    ok(o.adapterReads.filter(path => path === 'A.md').length > before, 'the edited body is reread through the adapter');
    const parents = o.index.getNeighborhood('A.md')?.parents.map(node => node.page.path);
    ok(JSON.stringify(parents) === '["B.md"]', 'the edit is published: ' + JSON.stringify(parents));
  } finally { o.close(); }
  return true;
})()`));

test('Given the body-cache prewarm, when it reads note bodies, then only the data adapter is used', async () => scenario(`(async () => {
  const o = await readsFixture('reads-prewarm', 'eager');
  try {
    ok(await o.index.prewarmBodyCache(() => true), 'prewarm completes without Vault cache reads');
    ok(o.adapterReads.includes('A.md') && o.adapterReads.includes('B.md'), 'bodies come from the adapter: ' + JSON.stringify(o.adapterReads));
  } finally { o.close(); }
  return true;
})()`));

test('Given the eager source inventory, when source acquisition reads note bodies, then only the data adapter is used', async () => scenario(`(async () => {
  const o = await readsFixture('reads-acquisition', 'eager');
  try {
    o.index.plugin.startupDiagnostics.processed = () => {};
    o.index.sourceAcquisition.enableInventory();
    await o.index.sourceAcquisition.reconcile(); await o.index.sourceAcquisition.flush();
    ok(o.index.sourceAcquisition.counters.vaultReads > 0, 'source acquisition read bodies itself (loadBody)');
    ok(o.adapterReads.includes('A.md') && o.adapterReads.includes('B.md'), 'through the adapter: ' + JSON.stringify(o.adapterReads));
  } finally { o.close(); }
  return true;
})()`));
