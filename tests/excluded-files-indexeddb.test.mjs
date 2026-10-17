/**
 * Eager source acquisition never admits Obsidian's excluded files: not in the inventory, not through
 * its own live create/modify/metadata listeners, and a rename into the exclusion only retires the old
 * source. Production GraphIndex and source acquisition over real Chromium IndexedDB; only the host is
 * doubled, and every body read (Vault cache or data adapter) is recorded.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { contributorBrowserBundle, contributorBrowserInitialize } from './support/contributorBrowserFixture.mjs';
import { chromiumHarness } from './support/browserTypeScript.mjs';
import { centerGateSettings } from './support/requestedCenterGateFixture.mjs';

const bundle = await contributorBrowserBundle(['src/index/GraphIndex.ts', 'src/index/GraphBuilder.ts', 'src/index/IndexSnapshot.ts']);

const initialize = `(() => {
  window.excludedFixture = async (name) => {
    const f = await fixture(name); f.app.vault.getName = () => name;
    f.app.vault.getAbstractFileByPath = path => f.files.get(path) ?? (path === '/' || path === '' ? f.app.vault.getRoot() : null);
    f.app.metadataCache.isUserIgnored = path => path.startsWith('Archive/');
    const reads = [];
    const read = async file => { reads.push(file.path); return f.texts.get(file.path) ?? ''; };
    f.app.vault.read = f.app.vault.cachedRead = read;
    f.app.vault.adapter = {read: async path => { reads.push(path); return f.texts.get(path) ?? ''; }};
    const settings = {...(${centerGateSettings.toString()})({showFolderNodes:false,renderSiblings:false}),
      hierarchy:{hidden:[],parents:['Parent'],children:['Child'],leftFriends:[],rightFriends:[],previous:[],next:[]},
      inferAllLinksAsFriends:false,inverseInfer:false,showFullTagName:true,tagStyleList:[],indexingMode:'eager',urlIndexingMode:'background',lastActivePath:'A.md',pinnedNodes:[]};
    const index = new sourceModules.GraphIndex({app:f.app,settings,getIndexSourceRevision:()=>0,
      startupDiagnostics:{mark(){},count(){},phase(){},recordWork:/** Receipts are not under test. */()=>{},processed(){}}},f.app);
    index.scheduleOrphanCleanup = () => {};
    f.add('A.md', 'Included note');
    f.add('Archive/Old.md', 'Excluded note');
    const settle = async () => { await index.sourceAcquisition.reconcile(); await index.sourceAcquisition.flush(); };
    return {f, index, reads, settle, close() { index.destroy(); f.close(); }};
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

test('Given the eager source inventory, when it runs, then an excluded note is never read or stored', async () => scenario(`(async () => {
  const o = await excludedFixture('excluded-inventory');
  try {
    o.index.sourceAcquisition.enableInventory(); await o.settle();
    ok(o.reads.includes('A.md'), 'included bodies are read: ' + JSON.stringify(o.reads));
    ok(!o.reads.includes('Archive/Old.md'), 'the excluded body is never read: ' + JSON.stringify(o.reads));
    const inspection = await o.f.repository.inspect('Archive/Old.md', [], () => true);
    ok(!inspection.head, 'no source head for the excluded note');
  } finally { o.close(); }
  return true;
})()`));

test('Given an established eager index, when an excluded note is created, edited and its metadata changes, then source acquisition admits nothing', async () => scenario(`(async () => {
  const o = await excludedFixture('excluded-live');
  try {
    o.index.sourceAcquisition.enableInventory(); await o.settle();
    const before = o.reads.length;
    const created = o.f.add('Archive/New.md', 'Excluded new note');
    o.f.app.vault.trigger('create', created);
    o.f.texts.set('Archive/Old.md', 'Excluded edit'); const old = o.f.files.get('Archive/Old.md'); old.stat = {...old.stat, mtime: old.stat.mtime + 1000};
    o.f.app.vault.trigger('modify', old); o.f.app.metadataCache.trigger('changed', old);
    o.f.app.metadataCache.trigger('resolved');
    await o.settle();
    const excludedReads = o.reads.slice(before).filter(path => path.startsWith('Archive/'));
    equal(excludedReads, [], 'no excluded body read after live events');
    ok(![...o.index.sourceAcquisition.pendingKnownFiles].some(file => file.path.startsWith('Archive/')), 'nothing excluded is queued');
    ok(!(await o.f.repository.inspect('Archive/New.md', [], () => true)).head, 'no head for the created excluded note');
  } finally { o.close(); }
  return true;
})()`));

test('Given an indexed note, when it is renamed into the exclusion, then its old source is retired and the new path is not read', async () => scenario(`(async () => {
  const o = await excludedFixture('excluded-rename');
  try {
    o.index.sourceAcquisition.enableInventory(); await o.settle();
    ok((await o.f.repository.inspect('A.md', [], () => true)).head, 'the included note has a head before the move');
    const file = o.f.files.get('A.md'); o.f.files.delete('A.md'); file.path = 'Archive/A.md'; file.name = 'A.md'; o.f.files.set(file.path, file); o.f.texts.set(file.path, o.f.texts.get('A.md'));
    o.f.app.vault.trigger('rename', file, 'A.md');
    o.f.app.metadataCache.trigger('resolved');
    await o.settle();
    ok(!o.reads.includes('Archive/A.md'), 'the new excluded path is not read: ' + JSON.stringify(o.reads));
    ok(!(await o.f.repository.inspect('Archive/A.md', [], () => true)).head, 'no source head is created for the excluded path');
    ok(![...o.index.sourceAcquisition.pendingKnownFiles].some(queued => queued.path.startsWith('Archive/')), 'the moved note is not queued for acquisition');
    const old = await o.f.repository.inspect('A.md', [], () => true);
    ok(!old.head || old.head.state !== 'complete', 'the old source no longer has a complete head: ' + JSON.stringify(old.head?.state));
  } finally { o.close(); }
  return true;
})()`));
