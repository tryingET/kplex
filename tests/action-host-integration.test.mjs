/** Host workflow persistence, menu/surface lifetimes and delayed physical identity use actual production callbacks. */
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporary = mkdtempSync(join(tmpdir(), 'kplex-action-host-'));
process.on('exit', () => rmSync(temporary, { recursive: true, force: true }));
await build({ stdin: { contents: 'export * from "./src/core/plex/actionPreferences"; export * from "./src/adapters/obsidian/actionNode"; export * from "./src/application/ActionManager"; export * from "./src/adapters/obsidian/relationshipMetadataWrite"; export * from "./src/core/parser/metadata"; export * from "./src/index/ForegroundWorkScheduler";', resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, outfile: join(temporary, 'contracts.mjs'), bundle: true, platform: 'node', format: 'esm' });
const contracts = await import(pathToFileURL(join(temporary, 'contracts.mjs')));

/** Extract the real callback with its sync/async contract intact, excluding native startup. */
function method(name, dependencies = {}) {
  const source = ts.createSourceFile('src/main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let expression;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) {
      const text = node.getText(source);
      expression = `${node.modifiers?.some(item => item.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : ''}function ${name}${text.slice(text.indexOf('('))}`;
    }
    ts.forEachChild(node, visit);
  }
  visit(source); assert(expression, name);
  const code = ts.transpileModule(`const selected = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(dependencies), `${code}; return selected;`)(...Object.values(dependencies));
}
const update = method('updateActionPreferences', { ...contracts, readObsidianPresentationEnvironment: () => ({ keyConvention: 'windows' }), window: {} });
const enqueue = method('enqueueSettingsWrite');
const persist = method('persistSettingsSnapshot');

/** A surface release owns only its current leaf/document menu, including a native-hide timer. */
test('surface disposal retires its menu and listeners without closing another owner or successor', () => {
  const document = () => {
    const listeners = new Set(), timers = new Map(); let sequence = 0;
    const doc = { listeners, timers, addEventListener: (_kind, fn) => listeners.add(fn), removeEventListener: (_kind, fn) => listeners.delete(fn) };
    doc.defaultView = { ...doc, setTimeout: callback => { timers.set(++sequence, callback); return sequence; }, clearTimeout: id => timers.delete(id) };
    return doc;
  };
  const main = document(), popout = document(), leaf = { view: { containerEl: { ownerDocument: main } } }, other = { view: { containerEl: { ownerDocument: main } } };
  const host = { actionSurfaceHosts: new Map(), actionDialogs: new Map(), supportEvents: { record() {} }, kplexMenuOutsidePointerDown() {}, kplexMenuEscapeKeyDown() {},
    activeKplexMenu: null, activeKplexMenuDocument: null, activeKplexMenuLeaf: null, justClosedKplexMenu: null, kplexMenuReleaseTimer: null,
    dismissKplexMenu: method('dismissKplexMenu'), trackKplexMenu: method('trackKplexMenu'), registerActionSurfaceHost: method('registerActionSurfaceHost') };
  const menu = () => ({ hidden: 0, onHide(callback) { this.callback = callback; }, hide() { this.hidden++; this.callback?.(); } });
  let release = host.registerActionSurfaceHost('one', 1, leaf), current = menu(); host.trackKplexMenu(current, main, leaf);
  // Obsidian adopts the container before the source React generation is disposed.
  leaf.view.containerEl.ownerDocument = popout; release();
  assert.equal(current.hidden, 1, 'Migrating source menu must close'); assert.equal(main.listeners.size, 0); assert.equal(main.timers.size, 0);
  const stale = host.registerActionSurfaceHost('one', 2, leaf); release = host.registerActionSurfaceHost('one', 3, leaf);
  current = menu(); host.trackKplexMenu(current, popout, leaf); stale();
  assert.equal(current.hidden, 0, 'Stale registration must preserve its successor');
  const releaseOther = host.registerActionSurfaceHost('other', 1, other); releaseOther(); assert.equal(current.hidden, 0, 'Another leaf must preserve the menu');
  release(); assert.equal(current.hidden, 1); assert.equal(popout.listeners.size, 0);
  leaf.view.containerEl.ownerDocument = main; release = host.registerActionSurfaceHost('one', 4, leaf);
  current = menu(); host.trackKplexMenu(current, popout, leaf); release(); assert.equal(current.hidden, 0, 'Same leaf in another document must preserve its menu'); host.dismissKplexMenu();
  release = host.registerActionSurfaceHost('one', 5, leaf); current = menu(); host.trackKplexMenu(current, main, leaf); current.hide();
  assert.equal(main.timers.size, 1, 'Native hide retains cancellation until the next task'); release();
  assert.equal(main.listeners.size, 0); assert.equal(main.timers.size, 0); assert.equal(host.justClosedKplexMenu, null);
});

/** Exercise the actual main command-association callback independently of native plugin initialization. */
function commandContext(dependencies) {
  const source = ts.createSourceFile('src/main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let expression;
  const visit = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'readCommandContext') expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source); assert(expression, 'main must retain its bounded native command context callback');
  const code = ts.transpileModule(`return ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  return Function(...Object.keys(dependencies), `return function createContext(){${code}};`)(...Object.values(dependencies));
}

test('native sidebar palette commands use its selected occurrence while legacy center and external editor resolution stay distinct', async () => {
  class KplexView {} class KplexSidepanelView {}
  const owner = {}, otherWindow = {}, mainLeaf = { view: Object.assign(new KplexView(), { containerEl: { ownerDocument: { defaultView: owner } } }) }, sidebar = { view: Object.assign(new KplexSidepanelView(), { containerEl: { ownerDocument: { defaultView: owner } } }) };
  let activeView = sidebar.view,recentLeaf=mainLeaf;
  const node = path => ({ identity:path,path,kind:'file' }), center=node('A'), selected=node('C'), calls=[];
  let mainSnapshot={mounted:true,visible:true,windowId:'own',center,selected:null,focusRegion:'external',commandFocusRegion:'external',interactionRevision:1};
  let sidebarSnapshot={...mainSnapshot,selected:{node:selected,occurrenceId:'C@child'},focusRegion:'graph',commandFocusRegion:'graph',interactionRevision:4};
  const plugin={app:{workspace:{getMostRecentLeaf:()=>recentLeaf,getActiveViewOfType:type=>activeView instanceof type?activeView:null}},actionSurfaceHosts:new Map([['main',{leaf:mainLeaf}],['sidebar',{leaf:sidebar}]]),settings:{lastActivePath:'A'},index:{get:()=>center},actionWindowId:value=>value===owner?'own':'other'};
  mainLeaf.view.leaf=mainLeaf;sidebar.view.leaf=sidebar;
  const contextFactory=commandContext({window:{activeWindow:owner},KplexView,KplexSidepanelView,actionNodeRef:page=>page});
  // The native recent-leaf API deliberately excludes left/right splits. The real active
  // sidebar stays active while its prompt takes DOM focus, and the existing ledger preserves graph origin.
  const read=contextFactory.call(plugin);
  const manager=new contracts.ActionManager({readCommandContext:request=>read(request),implementations:Object.fromEntries(['relationship.create-selected.child','relationship.create-center.child'].map(id=>[id,{availability:()=>({state:'enabled'}),execute:context=>{calls.push([id,context.target.node.path]);return {status:'completed'}}}]))});plugin.actionManager=manager;
  manager.registerSurface({id:'main',generation:1,readSnapshot:()=>mainSnapshot});manager.registerSurface({id:'sidebar',generation:1,readSnapshot:()=>sidebarSnapshot});manager.recordInteraction('sidebar');
  assert.equal(read({}).preferredSurfaceId,'sidebar','native active sidebar must outrank recent main Plex');
  activeView=mainLeaf.view;assert.equal(read({}).preferredSurfaceId,'sidebar','actual sidebar graph DOM focus outranks an ancestor native association');activeView=sidebar.view;
  sidebarSnapshot={...sidebarSnapshot,focusRegion:'external'};
  assert.equal(manager.check({id:'relationship.create-selected.child',source:'obsidian-command'}).state,'enabled');
  await manager.dispatch({id:'relationship.create-selected.child',source:'obsidian-command'});await manager.dispatch({id:'relationship.create-center.child',source:'obsidian-command'});
  assert.deepEqual(calls,[['relationship.create-selected.child','C'],['relationship.create-center.child','A']]);
  activeView=null;recentLeaf={view:{getViewType:()=> 'markdown'}};sidebarSnapshot={...sidebarSnapshot,commandFocusRegion:'external'};
  assert.equal(manager.check({id:'relationship.create-selected.child',source:'obsidian-command'}).state,'enabled','external B retains deterministic last-interacted valid selection C');
  await manager.dispatch({id:'relationship.create-selected.child',source:'obsidian-command'});assert.deepEqual(calls.at(-1),['relationship.create-selected.child','C']);
  assert.equal(manager.check({id:'relationship.create-center.child',source:'obsidian-command'}).state,'enabled','legacy background creation still uses shared A');
  sidebarSnapshot={...sidebarSnapshot,selected:null};assert.equal(manager.check({id:'relationship.create-selected.child',source:'obsidian-command'}).state,'disabled','retired selected occurrence never falls back to center A');
  activeView=sidebar.view;sidebar.view.containerEl.ownerDocument.defaultView=otherWindow;
  assert.notEqual(read({}).preferredSurfaceId,'sidebar','a different owning window cannot inherit the active sidebar association');manager.dispose();
});

/** Test failure/retry against real compiler and serialized host queues; semantic access is forbidden. */
function host(saveData) {
  return { settings: { actionPreferences: contracts.migrateActionPreferences(undefined).preferences, lastActivePath: 'A.md' }, unloading: false,
    translator: key => key, actionPreferenceQueue: Promise.resolve(), settingsWriteQueue: Promise.resolve(), actionPreferenceListeners: new Set(),
    enqueueSettingsWrite: enqueue, updateActionPreferences: update, persistSettingsSnapshot: persist, settingsSnapshotForPersistence: method("settingsSnapshotForPersistence"),
    actionPublisher: { sync: () => ({ failures: [] }) }, saveData,
    index: new Proxy({}, { get() { assert.fail('Workflow persistence must not acquire/invalidate semantic data'); } }) };
}
function draft(current) { return structuredClone(current.settings.actionPreferences); }

test('workflow save failure retains committed memory and permits explicit retry', async () => {
  let fail = true, notifications = 0;
  const current = host(async () => { if (fail) throw new Error('disk failed'); });
  current.actionPreferenceListeners.add(() => notifications++);
  const previous = current.settings.actionPreferences, next = draft(current); next.characterShortcutsEnabled = false;
  await assert.rejects(current.updateActionPreferences(next), /disk failed/);
  assert.equal(current.settings.actionPreferences, previous); assert.equal(notifications, 0);
  fail = false; await current.updateActionPreferences(next);
  assert.equal(current.settings.actionPreferences.characterShortcutsEnabled, false); assert.equal(notifications, 1);
});

test('ordinary pending settings save cannot overwrite a later workflow commit', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const writes = [];
  const current = host(async data => { writes.push(structuredClone(data)); if (writes.length === 1) await gate; });
  const first = current.persistSettingsSnapshot();
  const next = draft(current); next.characterShortcutsEnabled = false;
  const second = current.updateActionPreferences(next), third = current.persistSettingsSnapshot();
  await Promise.resolve(); release(); await Promise.all([first, second, third]);
  assert.equal(writes.at(-1).actionPreferences.characterShortcutsEnabled, false);
  assert.equal(current.settings.actionPreferences.characterShortcutsEnabled, false);
});

test('unsupported future schema remains verbatim and cannot be edited', async () => {
  const writes = [], current = host(async value => writes.push(value));
  current.settings.actionPreferencesFuture = { version: 8, opaque: { choices: [1, 2] } };
  await current.persistSettingsSnapshot();
  assert.equal(writes[0].actionPreferences, current.settings.actionPreferencesFuture);
  assert.equal("actionPreferencesFuture" in writes[0], false);
  await assert.rejects(current.updateActionPreferences(draft(current)), /actions.newerPreferences/);
  assert.equal(writes.length, 1);
});

test('explicit overlap with inherited defaults saves both and survives marked reload and unrelated edits', async () => {
  const writes=[],current=host(async data=>writes.push(structuredClone(data)));
  const next=draft(current);delete next.defaultBindingsVersion;next.localBindings['pin.toggle']=[{match:'code',value:'KeyR',modifiers:['alt']}];
  await current.updateActionPreferences(next);
  assert.equal(writes.length,1);assert.equal(current.settings.actionPreferences.defaultBindingsVersion,1);
  assert.equal(current.settings.actionPreferences.localBindings['node.rename'],undefined,'Inherited default is retained rather than disabled');
  const reloaded=contracts.migrateActionPreferences(writes[0]).preferences;
  assert.equal(contracts.compileActionBindings(reloaded,'windows').resolve({key:'r',code:'KeyR',altKey:true,ctrlKey:false,metaKey:false,shiftKey:false},'graph').state,'ambiguous');
  assert.equal(reloaded.localBindings['node.rename'],undefined);
  const unrelated=structuredClone(reloaded);unrelated.crossSectionAtBoundary=!unrelated.crossSectionAtBoundary;await current.updateActionPreferences(unrelated);
  assert.equal(current.settings.actionPreferences.localBindings['node.rename'],undefined);
  assert.deepEqual(current.settings.actionPreferences.localBindings['pin.toggle'],next.localBindings['pin.toggle']);
  const disabled=draft(current);disabled.localBindings['node.rename']=[];await current.updateActionPreferences(disabled);
  assert.equal(contracts.compileActionBindings(current.settings.actionPreferences,'windows').resolve({key:'r',code:'KeyR',altKey:true,ctrlKey:false,metaKey:false,shiftKey:false},'graph').state,'matched');
  const reset=draft(current);delete reset.localBindings['node.rename'];await current.updateActionPreferences(reset);
  const resetReload=contracts.migrateActionPreferences(writes.at(-1)).preferences;
  assert.equal(resetReload.localBindings['node.rename'],undefined,'Reset restores the inherited shortcut without removing its saved counterpart');
  assert.deepEqual(resetReload.localBindings['pin.toggle'],next.localBindings['pin.toggle']);
  assert.equal(contracts.compileActionBindings(resetReload,'windows').resolve({key:'r',code:'KeyR',altKey:true,ctrlKey:false,metaKey:false,shiftKey:false},'graph').state,'ambiguous');
});

test('malformed and future-generation workflow preferences reject before persistence or publication', async () => {
  const writes=[],current=host(async data=>writes.push(data));
  const invalid=draft(current);invalid.localBindings['pin.toggle']=[{match:'code',value:'UnknownCode',modifiers:['alt']}];
  await assert.rejects(current.updateActionPreferences(invalid),/actions.invalidPreferences/);
  const future=draft(current);future.defaultBindingsVersion=2;await assert.rejects(current.updateActionPreferences(future),/actions.invalidPreferences/);
  assert.equal(writes.length,0);
});

test('host file incarnation rejects delayed delete/recreate despite identical path and kind', () => {
  const first = { path: 'A.md', file: { path: 'A.md' } }, captured = contracts.actionNodeRef(first);
  assert.equal(contracts.resolveActionPage({ get: () => first }, captured), first);
  const replacement = { path: first.path, file: { path: first.path } };
  assert.equal(contracts.resolveActionPage({ get: () => replacement }, captured), null);
  first.file = replacement.file;
  assert.equal(contracts.resolveActionPage({ get: () => first }, captured), null, 'Mutable index page cannot substitute native identity');
});

test('exact pair acquisition rejects replacement after its await without reading replacement graph', async () => {
  const origin = { path: 'A.md' }, target = { path: 'B.md' }; let source = origin;
  const current = { translator: key => key, app: { vault: { getFileByPath: path => path === origin.path ? source : target } },
    index: { prepareRelationshipPair: async () => { source = { path: origin.path }; return true; }, get: () => assert.fail('Stale identity must not acquire replacement graph') } };
  await assert.rejects(method('prepareRelationshipMutation').call(current, origin.path, target.path, origin, target), /relation.preparingRelationship/);
});


test('delete confirmation cannot authorize replacement at the same path', async () => {
  const original = { path: 'A.md', extension: 'md' }, target = { path: original.path, file: original };
  let native = original; const notices = [];
  const current = { app: { vault: { getFileByPath: () => native }, fileManager: { trashFile: () => assert.fail('Replacement must not be trashed') } },
    index: { pages:new Map([[target.path,target]]), get: () => target }, translator: key => key, captureDeleteNodePreview: async () => ({sources:[],hiddenFields:[],hiddenField:""}),
    confirmDeleteNode: async () => { native = { path: original.path, extension: 'md' }; target.file = native; return true; } };
  const outcome = await method('deleteNode', { ...contracts, Notice: class { constructor(value) { notices.push(value); } } }).call(current, target);
  assert.equal(outcome.status, 'unavailable'); assert.equal(notices.length, 1);
});

test('action settings navigate the native declarative page without acquiring a modal session', () => {
  const paths = []; let opens = 0;
  const current = { manifest: { id: 'k-plex' }, translator: key => key,
    app: { setting: { open: () => opens++, openPagePath: (id, path) => { paths.push([id, path]); return {}; } } },
    openSettings: assert.fail, settingsTab: null };
  const open = method('openActionSettings').bind(current);
  assert.equal(open(), true); assert.equal(open(), true);
  assert.deepEqual(paths, [['k-plex', ['actions.settingsTitle']], ['k-plex', ['actions.settingsTitle']]]);
  assert.equal(opens, 2);
});

test('unsupported page navigation retains main settings recovery without a detached editor', () => {
  let opens = 0;
  const current = { app: {}, openSettings: () => opens++, settingsTab: { openActionSettingsPage: () => false } };
  assert.equal(method('openActionSettings').call(current), false); assert.equal(opens, 1);
});


test('support command stays available without a center or a readable graph during partial startup', /** Exercise the actual native command-context callback and portable dispatch with no live center. */ async () => {
  class KplexView {} class KplexSidepanelView {}
  const owner = {}; let executions = 0;
  const plugin = {
    app: { workspace: { getMostRecentLeaf: /** No native graph has finished opening. */ () => null, getActiveViewOfType: /** No current view owns a center. */ () => null } },
    actionSurfaceHosts: new Map(), settings: { lastActivePath: 'unavailable-center' },
    index: { get: /** A diagnostic recovery command must not depend on this unavailable graph reader. */ () => assert.fail('Support attempted a center lookup') },
    actionWindowId: /** Preserve the actual native window association without a node reference. */ () => 'own',
  };
  const create = commandContext({ window: { activeWindow: owner }, KplexView, KplexSidepanelView, actionNodeRef: assert.fail });
  const read = create.call(plugin);
  const manager = new contracts.ActionManager({ readCommandContext: read, implementations: {
    'support.report-bug': { availability: /** Reporting has no semantic readiness prerequisite. */ () => ({ state: 'enabled' }), execute: /** Count actual execution separately from pure availability checking. */ () => { executions++; return { status: 'completed' }; } },
  } });
  plugin.actionManager = manager;
  const request = { id: 'support.report-bug', source: 'obsidian-command' };
  assert.deepEqual(manager.check(request), { state: 'enabled' }); assert.equal(executions, 0);
  assert.equal((await manager.dispatch(request)).status, 'completed'); assert.equal(executions, 1);
  manager.dispose();
});

/** Host doubles retain canonical property grammar and the actual native metadata convergence observer. */
function deleteFixture(values = {Children:['[[B]]','[[C]]'], arbitrary:{nested:['[[B]]','[[C]]']}, hidden:['[[B]]']}) {
  const source={path:'Owner.md',extension:'md',stat:{mtime:1,size:100}}, nativeTarget={path:'Folder/B.md',extension:'md',stat:{mtime:1,size:20}};
  const target={path:nativeTarget.path,name:'B',file:nativeTarget,url:null},files=new Map([[source.path,source],[nativeTarget.path,nativeTarget]]);
  let frontmatter=structuredClone(values), cache={frontmatter}, body='---\n'+Object.keys(values).map(key=>key+': value').join('\n')+'\n---\n[[B]]\nChildren:: [[B]]';
  const events=()=>({refs:new Set(),on(kind,callback){const ref={kind,callback};this.refs.add(ref);return ref;},offref(ref){this.refs.delete(ref);},emit(kind,...args){for(const ref of this.refs)if(ref.kind===kind)ref.callback(...args);}});
  const vault=Object.assign(events(),{getFileByPath:path=>files.get(path)??null,cachedRead:async()=>body});
  const metadata=Object.assign(events(),{unresolvedLinks:{},getFileCache:()=>cache,getFirstLinkpathDest:raw=>raw==='B'||raw==='Folder/B.md'?files.get(nativeTarget.path)??null:raw==='C'?{path:'C.md'}:null});
  const app={vault,metadataCache:metadata,fileManager:{async processFrontMatter(file,update){await f.beforeNative?.();const next=structuredClone(frontmatter);update(next);frontmatter=next;cache={frontmatter};file.stat.mtime++;const lines=body.split('\n'),tail=lines.slice(lines.indexOf('---',1)+1).join('\n');body='---\n'+JSON.stringify(frontmatter)+'\n---\n'+tail;metadata.emit('changed',file,body,cache);}}};
  const patches=[],notices=[];
  const f={source,target,nativeTarget,files,app,patches,notices,get frontmatter(){return frontmatter;},set frontmatter(value){frontmatter=value;cache={frontmatter};},body:()=>body,setBody:text=>{body='---\n'+JSON.stringify(frontmatter)+'\n---\n'+text;source.stat.mtime++;source.stat.size=body.length;},beforeNative:null};
  const dependencies={...contracts,window:{setTimeout,clearTimeout},Notice:class{constructor(message){notices.push(message);}},SOURCE_DECODE_BUDGET_BYTES:8*1024*1024,
    normalizePath:value=>value.replaceAll('\\','/'),isUnknownRecord:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
    extractLinksFromValue:(host,value,file)=>contracts.extractLinkReferencesFromValue(value).map(ref=>host.metadataCache.getFirstLinkpathDest(ref.rawTarget,file.path)?.path??ref.rawTarget),
    iterateResolvedLinksFromValue:(host,value,file)=>contracts.extractLinkReferencesFromValue(value).map(ref=>host.metadataCache.getFirstLinkpathDest(ref.rawTarget,file.path)?.path??ref.rawTarget)};
  const context={app,settings:{hierarchy:{hidden:['hidden','Hide also']}},unloading:false,relationshipWriteCancels:new Set(),managedMetadataWrites:new Map(),pruneManagedMetadataWrites(){},
    translator:(key,params)=>key+(params?':'+params.path:''),allOntologyFields:()=>['Children'],referencingMarkdownFiles:()=>[source],
    index:{prepareRelationshipPair:async()=>true,isSemanticWriteReady:()=>true,patchMarkdownPaths:async(paths,options)=>{assert(options.isCurrent());patches.push(...paths);return{outcome:'patched',count:paths.length};}},
    markdownBodyReferenceLines:async()=>[3],remainingBodyReferences:()=>[{path:source.path,line:body.split('\n').indexOf('[[B]]'),label:'body',sourceKind:'obsidian-link'},{path:source.path,line:body.split('\n').indexOf('Children:: [[B]]'),label:'inline',sourceKind:'inline-ontology'}]};
  for(const name of ['captureDeleteNodePreview','valueContainsTarget','referenceMatchesTarget','normalizedNoteReferenceMatches','nonTargetReferenceCounts','stripTargetFromScalar','removeTargetFromValue','frontmatterPropertyLineRange','frontmatterDocumentLineRange','appendHiddenReference','deletionHiddenCoordinates','mutateRelationshipMetadata','removePropertyReferencesToNode']) context[name]=method(name,dependencies).bind(context);
  f.context=context;f.dematerialize=()=>{files.delete(nativeTarget.path);target.file=null;};
  f.run=async(preview)=>{const previous=globalThis.window;globalThis.window={setTimeout,clearTimeout};try{f.dematerialize();return await context.removePropertyReferencesToNode(target,preview,()=>files.get(nativeTarget.path)===undefined);}finally{globalThis.window=previous;}};return f;
}

/** Pre-trash canonical resolution captures short links and limits default cleanup to configured fields, including Hidden. */
test('delete preview defaults ontology and Hidden to Remove while arbitrary nested properties remain Keep',async()=>{
  const f=deleteFixture(),preview=await f.context.captureDeleteNodePreview(f.target);
  assert.deepEqual(preview.sources[0].properties.map(p=>[p.field,p.choice]),[['Children','remove'],['arbitrary','keep'],['hidden','remove']]);
  const beforeBody=f.body().split('---')[2],result=await f.run(preview);
  assert.deepEqual(f.frontmatter,{Children:['[[C]]'],arbitrary:{nested:['[[B]]','[[C]]']}});
  assert.equal(result.issues.length,0);assert(result.remaining.some(item=>item.fieldName==='arbitrary'));assert(result.remaining.some(item=>item.sourceKind==='obsidian-link'));
  assert.deepEqual(f.patches,['Owner.md']);assert.equal(f.body().split('---')[2],beforeBody);assert.equal(f.app.vault.refs.size+f.app.metadataCache.refs.size+f.context.relationshipWriteCancels.size,0);
});

/** Explicit choices affect only the named source/property; Hidden always keeps its original arbitrary links. */
for(const choice of ['remove','hide','keep'])test('explicit arbitrary property '+choice+' preserves unrelated references and body',async()=>{
  const f=deleteFixture({arbitrary:['[[B]]','[[B]]','[[C]]'],other:'untouched'}),preview=await f.context.captureDeleteNodePreview(f.target);
  preview.sources[0].properties[0].choice=choice;preview.hiddenField='Hide also';const result=await f.run(preview);
  assert.deepEqual(f.frontmatter.arbitrary,choice==='remove'?['[[C]]']:['[[B]]','[[B]]','[[C]]']);assert.equal(f.frontmatter.other,'untouched');assert.equal(result.issues.length,0);
  if(choice==='hide')assert.deepEqual(f.frontmatter['Hide also'],['[[Folder/B.md]]','[[B]]']);else assert.equal(f.frontmatter['Hide also'],undefined);
  assert.deepEqual(f.patches,choice==='keep'?[]:['Owner.md']);
});

/** Actual host aggregates may drop .md; Hidden must cover those opaque IDs without rewriting their source links. */
test('deletion Hidden covers captured full and short spellings plus observed native keys only',async()=>{
  const f=deleteFixture({arbitrary:'[[Folder/B.md]]',hidden:'[[C]]'}),resolver=f.app.metadataCache.getFirstLinkpathDest;
  f.app.metadataCache.getFirstLinkpathDest=raw=>raw==='B.md'?f.files.get('Folder/B.md')??null:resolver(raw);
  f.setBody('[[B.md]]\nChildren:: [[B.md]]\n[[Other/B]]');
  const preview=await f.context.captureDeleteNodePreview(f.target);
  assert.deepEqual(preview.sources[0].targetSpellings,['Folder/B.md','B.md']);
  preview.sources[0].properties.find(p=>p.field==='arbitrary').choice='hide';
  f.app.metadataCache.unresolvedLinks['Owner.md']={'Folder/B':1,B:2,'Other/B':1,'Unrelated.md':1};
  const original=f.body().split('\n').slice(3).join('\n'),result=await f.run(preview);
  assert.equal(result.issues.length,0);assert.equal(f.frontmatter.arbitrary,'[[Folder/B.md]]');
  assert.deepEqual(f.frontmatter.hidden,['[[C]]','[[Folder/B.md]]','[[B.md]]','[[Folder/B]]','[[B]]']);
  assert.equal(f.body().split('\n').slice(3).join('\n'),original);assert.deepEqual(f.patches,['Owner.md']);
});

/** Extension equivalence does not authorize a basename that never resolved to the original target. */
test('deletion Hidden never derives a short key from a full target basename',async()=>{
  const f=deleteFixture({arbitrary:'[[Folder/B.md]]'});f.setBody('[[Folder/B.md]]');
  const preview=await f.context.captureDeleteNodePreview(f.target);preview.sources[0].properties[0].choice='hide';
  f.app.metadataCache.unresolvedLinks['Owner.md']={'Folder/B':1,B:1,'Other/B':1};
  const result=await f.run(preview);assert.equal(result.issues.length,0);
  assert.deepEqual(f.frontmatter.hidden,['[[Folder/B.md]]','[[Folder/B]]']);
});

/** Duplicate exact declarations remain additive once, while different .md coordinates cannot short-circuit each other. */
test('deletion Hidden deduplicates exact coordinates while retaining both native and lexical endpoints',async()=>{
  const f=deleteFixture({arbitrary:'[[Folder/B.md]]',hidden:['[[Folder/B]]','[[C]]']});f.setBody('[[Folder/B.md]]');
  const preview=await f.context.captureDeleteNodePreview(f.target);for(const property of preview.sources[0].properties)property.choice=property.field==='arbitrary'?'hide':'keep';
  f.app.metadataCache.unresolvedLinks['Owner.md']={'Folder/B':3};
  const result=await f.run(preview);assert.equal(result.issues.length,0);
  assert.deepEqual(f.frontmatter.hidden,['[[Folder/B]]','[[C]]','[[Folder/B.md]]']);
});

/** Native awaited reads cannot adopt a newly edited body or an unrelated file now owning an approved short spelling. */
for(const hazard of ['body-change','short-rebound','oversized-native-map'])test('deletion Hidden refuses '+hazard+' before assigning any approved property',async()=>{
  const f=deleteFixture({Children:'[[B]]',arbitrary:'[[B]]'}),preview=await f.context.captureDeleteNodePreview(f.target);preview.sources[0].properties.find(p=>p.field==='arbitrary').choice='hide';
  f.beforeNative=()=>{
    if(hazard==='body-change')f.setBody('[[B]]\nChanged body');
    if(hazard==='short-rebound'){const resolver=f.app.metadataCache.getFirstLinkpathDest;f.app.metadataCache.getFirstLinkpathDest=raw=>raw==='B'?{path:'Other/B.md'}:resolver(raw);}
    if(hazard==='oversized-native-map')f.app.metadataCache.unresolvedLinks['Owner.md']={['Unrelated'.repeat(300000)]:1,B:1};
  };
  const result=await f.run(preview);assert(result.issues.some(i=>i.startsWith('delete.cleanup.sourceFailed')));assert.equal(f.patches.length,0);
  assert.deepEqual(f.frontmatter,{Children:'[[B]]',arbitrary:'[[B]]'});assert.equal(f.context.relationshipWriteCancels.size+f.app.metadataCache.refs.size+f.app.vault.refs.size,0);
});

/** Fresh native callback approval fences exact payload, source incarnation and absent target after its await. */
for(const hazard of ['payload','source-replacement','source-rename','target-recreation'])test('delete cleanup refuses '+hazard+' during native awaited read',async()=>{
  const f=deleteFixture({Children:['[[B]]'],arbitrary:'[[B]]'}),preview=await f.context.captureDeleteNodePreview(f.target);
  f.beforeNative=()=>{if(hazard==='payload')f.frontmatter={Children:['[[B]]','[[C]]'],arbitrary:'[[B]]'};if(hazard==='source-replacement')f.files.set('Owner.md',{...f.source});if(hazard==='source-rename'){f.files.delete('Owner.md');f.source.path='Renamed.md';f.files.set(f.source.path,f.source);}if(hazard==='target-recreation')f.files.set('Folder/B.md',{...f.nativeTarget});};
  const result=await f.run(preview);assert.equal(f.patches.length,0);assert.equal(result.issues.length,1);assert.deepEqual(f.frontmatter.Children,hazard==='payload'?['[[B]]','[[C]]']:['[[B]]']);
  assert.equal(f.context.relationshipWriteCancels.size+f.app.metadataCache.refs.size+f.app.vault.refs.size,0);
});

/** Unrelated property edits are preserved because approval compares only the selected field payload. */
test('delete selected property consent permits independent field updates and preserves them',async()=>{
  const f=deleteFixture({Children:'[[B]]',other:'old'}),preview=await f.context.captureDeleteNodePreview(f.target);
  f.beforeNative=()=>{f.frontmatter={...f.frontmatter,other:'new'};};await f.run(preview);assert.deepEqual(f.frontmatter,{other:'new'});
});

/** A saved file whose graph replay is cancelled must be reported pending and never optimistically erase evidence. */
test('delete saved source retains pending status when canonical publication is unavailable',async()=>{
  const f=deleteFixture({Children:'[[B]]'}),preview=await f.context.captureDeleteNodePreview(f.target);
  f.context.index.patchMarkdownPaths=async()=>({outcome:'cancelled',count:0,pendingPaths:['Owner.md']});
  const result=await f.run(preview);assert.deepEqual(f.frontmatter,{});assert(result.issues[0].startsWith('delete.cleanup.sourcePending'));
});

/** Existing one-time/physical confirmation preferences cannot authorize arbitrary property scope. */
for(const hasFile of [false,true])for(const extras of [false,true])test('legacy delete consent '+(hasFile?'physical':'placeholder')+' extras='+extras,async()=>{
  const decisions=[];class Modal{constructor(app,options){decisions.push(options);}onClose(){decisions.at(-1).onCancel();}close(){this.onClose();}open(){this.close();}}
  const context={app:{},relationshipWriteCancels:new Set(),settings:{deletePromptInitialized:true,confirmFileDelete:false},confirmDeleteNode:method('confirmDeleteNode',{DeleteNodeConfirmationModal:Modal}),openRelationshipEvidenceLocation(){}};
  const result=await context.confirmDeleteNode({name:'B',file:hasFile?{}:null},{sources:[{properties:[{ontology:!extras}]}]});
  assert.equal(result,!extras);assert.equal(decisions.length,extras?1:0);
});

/** Preview admission refuses excessive copied payloads before any native trash can be requested. */
test('delete preview rejects an oversized source before native effects',async()=>{
  const f=deleteFixture();f.source.stat.size=9*1024*1024;await assert.rejects(f.context.captureDeleteNodePreview(f.target),/previewTooLarge/);assert(f.files.has('Folder/B.md'));assert.equal(f.patches.length,0);
});

/** Canonical source commits are independent: later native failure does not undo an earlier source or erase failed evidence. */
test('delete retains first source commit when another source native edit fails',async()=>{
 const a=deleteFixture({Children:'[[B]]'}),b=deleteFixture({Children:'[[B]]'});b.source.path='Other.md';b.files.delete('Owner.md');b.files.set(b.source.path,b.source);
 const pa=await a.context.captureDeleteNodePreview(a.target),pb=await b.context.captureDeleteNodePreview(b.target);pa.sources.push(...pb.sources);a.files.set(b.source.path,b.source);
 const originalCache=a.app.metadataCache.getFileCache,originalRead=a.app.vault.cachedRead,originalWrite=a.context.mutateRelationshipMetadata;
 a.app.metadataCache.getFileCache=file=>file===b.source?b.app.metadataCache.getFileCache(file):originalCache(file);a.app.vault.cachedRead=file=>file===b.source?b.app.vault.cachedRead(file):originalRead(file);
 a.context.mutateRelationshipMetadata=async(file,...args)=>{if(file===b.source)throw new Error('native denied');return originalWrite(file,...args);};
 const result=await a.run(pa);assert.deepEqual(a.frontmatter,{});assert.deepEqual(b.frontmatter,{Children:'[[B]]'});assert.deepEqual(a.patches,['Owner.md']);assert.equal(result.issues.length,1);assert(result.issues[0].includes('Other.md'));
});

/** Inspection failures after saving are distinct from an unsaved source and cannot fail a committed deletion. */
for(const hazard of ['read-rejection','source-retirement','source-growth'])test('saved source inspection '+hazard+' is truthfully reported',async()=>{
 const f=deleteFixture({Children:'[[B]]',arbitrary:'[[B]]'}),preview=await f.context.captureDeleteNodePreview(f.target);const patch=f.context.index.patchMarkdownPaths;
 f.context.index.patchMarkdownPaths=async(...args)=>{const result=await patch(...args);if(hazard==='read-rejection')f.app.vault.cachedRead=async()=>{throw new Error('gone');};if(hazard==='source-retirement'){const read=f.app.vault.cachedRead;f.app.vault.cachedRead=async()=>{const content=await read();f.files.delete('Owner.md');return content;};}if(hazard==='source-growth')f.source.stat.size=10*1024*1024;return result;};
 const result=await f.run(preview);assert.deepEqual(f.frontmatter,{arbitrary:'[[B]]'});assert.deepEqual(f.patches,['Owner.md']);assert(result.issues.some(issue=>issue.startsWith('delete.cleanup.inspectFailed')));
});

/** The shared additive writer is used by connection consent, preserves all original sources and closes its observer lifetime. */
for(const hazard of ['success','cancel','replacement','hidden-payload','retired-owner','refreshed-facade','canonical-replacement','priority-scheduler'])test('confirmed connection Hidden '+hazard+' uses exact source consent',async()=>{
 const f=deleteFixture({Children:'[[B]]',arbitrary:['[[B]]','[[C]]']}),owner={path:f.source.path,name:'Owner',file:f.source,url:null};
 f.context.index.pages=new Map([[owner.path,owner],[f.target.path,f.target]]);
 f.context.index.get=path=>path===owner.path?owner:path===f.target.path?f.target:undefined;f.context.index.withForegroundPriority=async work=>work();f.context.publishSavedRelationship=async()=>{};
 const scheduler=hazard==='priority-scheduler'?new contracts.ForegroundWorkScheduler():null;
 if(scheduler){f.context.index.withForegroundPriority=work=>scheduler.run(0,work);f.context.index.prepareRelationshipPair=async()=>{await scheduler.checkpoint(0);return true;};f.context.index.patchMarkdownPaths=async(paths,options)=>{assert.equal(scheduler.diagnostics().active[0],0,'P2 source publication must not wait behind its own P0 write lease');await scheduler.checkpoint(2);assert(options.isCurrent());f.patches.push(...paths);return{outcome:'patched'};};f.context.publishSavedRelationship=()=>scheduler.run(0,()=>scheduler.checkpoint(0));}
 if(hazard==='refreshed-facade'||hazard==='canonical-replacement')f.context.index.prepareRelationshipPair=async()=>{if(hazard==='canonical-replacement')f.context.index.pages.set(owner.path,{...owner});const current=new Map([[owner.path,{...owner}],[f.target.path,{...f.target}]]);f.context.index.get=path=>current.get(path);return true;};
 class Modal{constructor(app,sources,fields,target,decision){this.decision=decision;this.decided=false;}onClose(){if(!this.decided){this.decided=true;this.decision(null);}}close(){this.onClose();}open(){this.decided=true;this.close();this.decision(hazard==='cancel'?null:{sourcePath:'Owner.md',field:'Hide also'});}}
 f.context.hideRelationship=method('hideRelationship',{...contracts,normalizeFieldName:contracts.normalizeFieldName,HideRelationshipModal:Modal,Notice:class{},relationshipMetadataPayload:contracts.relationshipMetadataPayload}).bind(f.context);
 f.beforeNative=()=>{if(hazard==='replacement')f.files.set(f.source.path,{...f.source});if(hazard==='hidden-payload')f.frontmatter={...f.frontmatter,'Hide also':'[[C]]'};};
 const previous=globalThis.window;globalThis.window={setTimeout,clearTimeout};let result;try{result=await f.context.hideRelationship(owner.path,f.target.path,()=>hazard!=='retired-owner');}finally{scheduler?.close();globalThis.window=previous;}
 assert.deepEqual(f.frontmatter.Children,'[[B]]');assert.deepEqual(f.frontmatter.arbitrary,['[[B]]','[[C]]']);
 assert.equal(result.status,hazard==='success'||hazard==='refreshed-facade'||hazard==='priority-scheduler'?'committed':hazard==='cancel'||hazard==='retired-owner'?'cancelled':hazard==='canonical-replacement'?'unavailable':'failed');
 if(hazard==='success'||hazard==='refreshed-facade'||hazard==='priority-scheduler')assert.deepEqual(f.frontmatter['Hide also'],['[[Folder/B.md]]']);assert.equal(f.context.relationshipWriteCancels.size+f.app.metadataCache.refs.size+f.app.vault.refs.size,0);
 if(scheduler){assert.deepEqual(scheduler.diagnostics().active,[0,0,0,0,0]);assert.equal(scheduler.diagnostics().waiting,0);assert.deepEqual(f.patches,['Owner.md']);}
});

/** Native trash awaits cannot dematerialize a replacement file at the original path. */
test('delete native trash await never dematerializes a recreated target',async()=>{
 const file={path:'B.md',extension:'md'},target={path:file.path,name:'B',file},replacement={path:file.path,file:{path:file.path,extension:'md'}};let live=file,current=target;
 const context={app:{vault:{getFileByPath:()=>live},fileManager:{trashFile:async()=>{live=replacement.file;current=replacement;}}},index:{pages:new Map([[target.path,target]]),get:()=>current,dematerializeFile:()=>assert.fail('Cannot dematerialize replacement'),removeVirtualPageIfUnreferencedFromSources:async()=>false},
 settings:{pinnedNodes:[],navigationHistory:[]},captureDeleteNodePreview:async()=>({sources:[]}),confirmDeleteNode:async()=>true,removeFromNavigationHistory(){},saveSettings:async()=>{},removePropertyReferencesToNode:async()=>({remaining:[],issues:[]})};
 const result=await method('deleteNode',{...contracts,Notice:class{}}).call(context,target);assert.equal(result.status,'committed');assert.equal(current,replacement);assert.equal(replacement.file,live);
});

/** Unloading retires pending delete consent instead of retaining an approval capable of trash. */
test("delete pending consent is plugin owned and unloading cancels before native work",async()=>{
  let modal;class Modal{constructor(app,options){this.options=options;modal=this;}open(){}onClose(){this.options.onCancel();}close(){this.onClose();}}
  const context={app:{},relationshipWriteCancels:new Set(),settings:{deletePromptInitialized:true,confirmFileDelete:true},openRelationshipEvidenceLocation(){}};
  const pending=method("confirmDeleteNode",{DeleteNodeConfirmationModal:Modal}).call(context,{name:"B",file:{}},{sources:[]});
  assert.equal(context.relationshipWriteCancels.size,1);context.unloading=true;for(const cancel of [...context.relationshipWriteCancels])cancel();
  assert.equal(await pending,false);assert.equal(context.relationshipWriteCancels.size,0);modal.close();assert.equal(context.relationshipWriteCancels.size,0);
});

/** Each awaited pre-trash boundary rejects unload, including approval after a preference save. */
for(const phase of ["preview","confirmation"])test("delete unload during "+phase+" cannot trash native target",async()=>{
  const file={path:"B.md",extension:"md"},target={path:file.path,file};
  const context={app:{vault:{getFileByPath:()=>file},fileManager:{trashFile:()=>assert.fail("Unloading must not trash")}},index:{pages:new Map([[target.path,target]]),get:()=>target},translator:key=>key,
    captureDeleteNodePreview:async()=>{if(phase==="preview")context.unloading=true;return {sources:[]};},
    confirmDeleteNode:async()=>{assert.equal(phase,"confirmation");context.unloading=true;return true;}};
  const result=await method("deleteNode",{...contracts,Notice:class{}}).call(context,target);assert.equal(result.status,"unavailable");
});

/** Detached native approval failure settles once, releases lifetime ownership and never reaches trash. */
test("delete preference persistence rejection cannot approve or strand deletion",async()=>{
  class Modal{constructor(app,options){this.options=options;}onClose(){}close(){this.onClose();}open(){this.close();void this.options.onConfirm(true);}}
  const file={path:"B.md",extension:"md"},target={path:file.path,file};
  const context={app:{vault:{getFileByPath:()=>file},fileManager:{trashFile:()=>assert.fail("Rejected consent must not trash")}},index:{pages:new Map([[target.path,target]]),get:()=>target},
    settings:{deletePromptInitialized:false,confirmFileDelete:true},relationshipWriteCancels:new Set(),openRelationshipEvidenceLocation(){},
    captureDeleteNodePreview:async()=>({sources:[]}),saveSettings:async()=>{throw Error("preference persistence failed");},
    confirmDeleteNode:method("confirmDeleteNode",{DeleteNodeConfirmationModal:Modal})};
  await assert.rejects(method("deleteNode",contracts).call(context,target),/preference persistence failed/);assert.equal(context.relationshipWriteCancels.size,0);
});

/** Individually admitted finite sources cannot accumulate beyond the whole-preview retained-data budget. */
test("delete preview aggregate budget refuses two individually admissible sources before trash",async()=>{
  const f=deleteFixture({Children:"[[B]]"}),other={...f.source,path:"Other.md",stat:{...f.source.stat}};
  const content="---\nChildren: '[[B]]'\n---\n"+"x".repeat(1_200_000);f.source.stat.size=content.length;other.stat.size=content.length;f.files.set(other.path,other);f.app.vault.cachedRead=async()=>content;
  for(const source of [f.source,other]){f.context.referencingMarkdownFiles=()=>[source];assert.equal((await f.context.captureDeleteNodePreview(f.target)).sources.length,1);}
  f.context.referencingMarkdownFiles=()=>[f.source,other];await assert.rejects(f.context.captureDeleteNodePreview(f.target),/previewTooLarge/);
  assert.equal(f.files.get(f.nativeTarget.path),f.nativeTarget);assert.equal(f.target.file,f.nativeTarget);assert.equal(f.patches.length,0);
});

/** Exact pair publication replaces a read facade without replacing the approved canonical endpoint. */
for(const replaceCanonical of [false,true])test('delete cleanup '+(replaceCanonical?'rejects a replaced canonical ghost':'survives refreshed ghost pair facades'),async()=>{
 const f=deleteFixture({Children:'[[B]]',arbitrary:'[[B]]'}),index=f.context.index,canonical=f.target;
 let facade={...canonical},semanticChecks=0,reports=0;index.pages=new Map([[canonical.path,canonical]]);index.get=()=>facade;
 index.dematerializeFile=path=>{assert.equal(path,canonical.path);canonical.file=null;facade={...canonical};return canonical;};
 index.prepareRelationshipPair=async()=>{if(replaceCanonical)index.pages.set(canonical.path,{...canonical});facade={...index.pages.get(canonical.path)};return true;};
 index.isSemanticWriteReady=()=>{semanticChecks++;return true;};
 const patch=index.patchMarkdownPaths;index.patchMarkdownPaths=async(...args)=>{facade={...canonical};return patch(...args);};
 index.removeVirtualPageIfUnreferencedFromSources=()=>assert.fail('Preserved arbitrary references retain ghost');
 f.app.fileManager.trashFile=async()=>{f.dematerialize();};
 Object.assign(f.context.settings,{pinnedNodes:[],navigationHistory:[]});Object.assign(f.context,{confirmDeleteNode:async()=>true,removeFromNavigationHistory(){},saveSettings:async()=>{}});
 const run=method('deleteNode',{...contracts,Notice:class{},RemainingNodeReferencesModal:class{open(){reports++;}}});
 const previous=globalThis.window;globalThis.window={setTimeout,clearTimeout};try{
  const result=await run.call(f.context,facade);assert.equal(result.status,'committed');assert.equal(reports,1);assert.equal(f.files.has(f.nativeTarget.path),false);
  if(replaceCanonical){assert.deepEqual(f.frontmatter,{Children:'[[B]]',arbitrary:'[[B]]'});assert.equal(semanticChecks,0);assert.deepEqual(f.patches,[]);}
  else{assert.deepEqual(f.frontmatter,{arbitrary:'[[B]]'});assert(semanticChecks>0,'Existing writer still requires semantic pair authority');assert.deepEqual(f.patches,['Owner.md']);assert.equal(index.pages.get(canonical.path),canonical);assert.equal(facade.file,null);}
  assert.equal(f.context.relationshipWriteCancels.size,0);
 }finally{globalThis.window=previous;}
});
