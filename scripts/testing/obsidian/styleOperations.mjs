/**
 * Exact-build style-operation acceptance in the explicitly selected prepared small Obsidian vault.
 * Uses the real native manager/editor and queued persistence with reversible storage/refresh faults.
 * Owns only synthetic style keys, finite forwarding probes and native layout/settings changes;
 * cleanup restores configuration bytes independently of assertions. DOM activation is programmatic,
 * not physical touch or perceived-latency evidence. No production diagnostics are installed.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { obsidianCliExecutable, spawnNativeSync } from "./processTools.mjs";
import { validateTarget } from "./runner.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const vaultName = process.env.KPLEX_TEST_VAULT_NAME;
assert.equal(
  vaultName,
  "kplex-test-small",
  "Select the prepared disposable small vault explicitly"
);
const { vault, config, pluginDir } = validateTarget({
  vaultName,
  vaultPath: process.env.KPLEX_TEST_VAULT_PATH,
  configDir: process.env.KPLEX_TEST_CONFIG_DIR,
});
const output = process.env.KPLEX_HOST_REPORT_DIR;
assert(
  output && (!existsSync(output) || readdirSync(output).length === 0),
  "Select a fresh report directory"
);
mkdirSync(output, { recursive: true });
writeFileSync(
  join(output, "driver-source.mjs"),
  readFileSync(fileURLToPath(import.meta.url))
);
/** Use bounded, shell-free IPC and reject CLI error payloads even when the launcher exits successfully. */
function cli(command, ...args) {
  const result = spawnNativeSync(
    obsidianCliExecutable(),
    [`vault=${vaultName}`, command, ...args],
    {
      encoding: "utf8",
      timeout: 30000,
      killSignal: "SIGKILL",
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  if (result.error || result.status !== 0 || /^Error:/m.test(result.stdout))
    throw result.error ?? new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
/** Decode finite observations without retaining native objects across IPC or reloads. */
function evaluate(code) {
  return JSON.parse(cli("eval", "code=" + code).replace(/^=>\s*/, ""));
}
/** Poll outside the renderer, leaving its ordinary tasks and native cleanup free to progress. */
function pause(milliseconds) {
  return new Promise(
    /** Resolve one bounded poll interval. */ (resolve) =>
      setTimeout(resolve, milliseconds)
  );
}
assert.equal(cli("vault", "info=path"), vault);
const bytes = [
  "plugins/k-plex/data.json",
  "community-plugins.json",
  "workspace.json",
].map(
  /** Preserve actual native configuration independently of runtime cleanup success. */ (
    name
  ) => ({ path: join(config, name), bytes: readFileSync(join(config, name)) })
);
const artifacts = Object.fromEntries(
  ["main.js", "styles.css", "manifest.json"].map(
    /** Refuse stale installed artifacts rather than claiming evidence for an untested source build. */ (
      name
    ) => {
      const built = readFileSync(join(root, "dist", name));
      assert(built.equals(readFileSync(join(pluginDir, name))));
      return [name, createHash("sha256").update(built).digest("hex")];
    }
  )
);

/** Run real style-manager operations with finite fault injection and exact native modal ownership. */
function start() {
  const p = app.plugins.plugins["k-plex"],
    tab = p.settingsTab,
    remote = require("@electron/remote"),
    native = remote.getCurrentWindow();
  if (
    window.__kplex146Styles ||
    app.setting.isOpen ||
    (tab.containerEl.isConnected &&
      !tab.containerEl.ownerDocument.defaultView?.closed) ||
    document.querySelector(
      ".kplex-style-editor-modal,.kplex-style-manager-modal"
    )
  )
    throw new Error("Clean host prerequisites required");
  const c = (window.__kplex146Styles = {
    settings: structuredClone(p.settings),
    policy: p.savedSettingsPolicy,
    layout: app.workspace.getLayout(),
    owners: {
      linked: p.linkedDocumentLeaf,
      last: p.lastDocumentLeaf,
      recent: [...p.recentLeafHistory],
      sidecars: new Map(p.sidecarLeaves),
    },
    cases: [],
    events: [],
    restores: [],
    modals: [],
    done: false,
    cancelled: false,
    diskFailure: false,
    presentationFailure: false,
    managerFailure: false,
    counts: {
      writes: 0,
      presentations: 0,
      semantics: 0,
      acquisitions: 0,
      reads: 0,
      sourceReads: 0,
      nativeLeafReads: 0,
    },
    release: null,
  });
  const key = "__kplex146_style",
    other = key + "_renamed";
  /** Fail a bounded probe or retire its exact controller without leaving delayed operations alive. */
  const check = (condition, message) => {
    if (c.cancelled || !condition)
      throw new Error(c.cancelled ? "Retired style probe" : message);
  };
  /** Yield the selected document's native task queue with cancellation on both sides of the await. */
  const wait = async (milliseconds) => {
    check(true, "alive");
    await new Promise(
      /** Yield one owning-window task. */ (resolve) =>
        window.setTimeout(resolve, milliseconds)
    );
    check(true, "alive");
  };
  /** Require an observed native state within the existing finite functional deadline. */
  const until = async (read, label) => {
    const end = performance.now() + 15000;
    while (!read()) {
      check(performance.now() < end, label);
      await wait(25);
    }
  };
  /** Mark only completed observable checks as passed. */
  const passed = (name, details = {}) =>
    c.cases.push({ name, status: "passed", ...details });
  /** Search only the concrete native documents that can own this Settings/editor invocation. */
  const documents = () => [
    ...new Set(
      [document, window.activeDocument, tab.containerEl.ownerDocument].filter(
        Boolean
      )
    ),
  ];
  /** Reacquire the currently mounted real editor; never treat a detached old modal as its replacement. */
  const editor = () =>
    documents()
      .map(
        /** Find an actual editor in its document. */ (doc) =>
          doc.querySelector(".kplex-style-editor-modal")
      )
      .find(Boolean);
  /** Select a localized native action through its actual button, preserving all production callbacks. */
  const button = (root, name) =>
    [...root.querySelectorAll("button")].find(
      /** Match a real native action label. */ (element) =>
        element.textContent === p.translator(name)
    );
  /** Record separate storage/presentation/manager boundaries; times are diagnostics, not paint measurements. */
  const record = (phase, edge) =>
    c.events.push({ phase, edge, time: performance.now() });
  /** Retain an exact forwarding receiver and restore only the probe's installed method. */
  const wrap = (owner, key, replacement) => {
    const original = owner[key];
    owner[key] = replacement(original);
    const installed = owner[key];
    c.restores.push(
      /** Release this exact wrapper without overwriting another owner's replacement. */ () => {
        if (owner[key] === installed) owner[key] = original;
      }
    );
  };
  wrap(
    p,
    "saveData",
    /** Storage faults occur before native persistence; held writes are released during cleanup. */ (
      original
    ) =>
      async function (...args) {
        c.counts.writes++;
        record("storage", "start");
        if (c.diskFailure)
          throw new Error("Expected native style storage fault");
        if (c.holdDisk)
          await new Promise(
            /** Expose only this controller's bounded storage release. */ (
              resolve
            ) => {
              c.release = resolve;
            }
          );
        const result = await original.apply(this, args);
        record("storage", "end");
        return result;
      }
  );
  wrap(
    p.index,
    "refreshPresentationSettings",
    /** Distinguish a saved refresh fault from a rejected disk write. */ (
      original
    ) =>
      async function (...args) {
        c.counts.presentations++;
        record("presentation", "start");
        if (c.presentationFailure)
          throw new Error("Expected native presentation fault");
        const result = await original.apply(this, args);
        record("presentation", "end");
        return result;
      }
  );
  wrap(
    p.index,
    "refreshSemanticSettings",
    /** A style operation must never invoke this unrelated semantic owner. */ (
      original
    ) =>
      function (...args) {
        c.counts.semantics++;
        return original.apply(this, args);
      }
  );
  wrap(
    p.index.sourceAcquisition,
    "acquire",
    /** Count actual source work while retaining native acquisition behavior. */ (
      original
    ) =>
      function (...args) {
        c.counts.acquisitions++;
        return original.apply(this, args);
      }
  );
  for (const name of ["read", "cachedRead"])
    wrap(
      app.vault,
      name,
      /** Observe native read kinds without retaining filenames or file contents. */ (
        original
      ) =>
        function (...args) {
          const stack = new Error().stack ?? "";
          const frames = stack
            .split("\n")
            .slice(1, 9)
            .map(
              /** Keep function names only, excluding source paths and note identities. */ (
                line
              ) => line.match(/^\s*at ([\w.$<>]+)/)?.[1] ?? "anonymous"
            );
          const pluginCaller = stack.includes("plugin:k-plex");
          // Returning focus to the ordinary Markdown leaf can invoke native file-open handlers.
          // Count those separately only with positive caller evidence; unknown/plugin reads stay strict.
          const nativeLeaf =
            !pluginCaller &&
            frames.some(
              /** Identify the observed native FileView/metadata lifecycle, not arbitrary reads. */ (
                frame
              ) => /\.(loadFileInternal|onFileOpen|onFileChanged)$/.test(frame)
            );
          if (nativeLeaf) c.counts.nativeLeafReads++;
          else c.counts.sourceReads++;
          c.counts.reads++;
          (c.readFacts ??= []).push({
            kind: args[0]?.extension ?? typeof args[0],
            inspector: Boolean(c.inspectingStorage),
            method: name,
            pluginCaller,
            nativeLeaf,
            frames,
            time: performance.now(),
          });
          return original.apply(this, args);
        }
    );
  wrap(
    tab,
    "nodeStyleEntries",
    /** The manager can throw after persistence; do not simulate an unsaved operation. */ (
      original
    ) =>
      function (...args) {
        if (c.managerFailure) throw new Error("Expected native manager fault");
        return original.apply(this, args);
      }
  );

  /** Open the real manager, then its real Add/row action, in the current native document. */
  const open = async (kind, name = null, managerAlreadyOpen = false) => {
    if (!managerAlreadyOpen) tab.openNoteTypeStylesManager();
    await until(
      /** Wait for native attachment in its concrete owner. */ () =>
        documents().some((doc) =>
          doc.querySelector(".kplex-style-manager-modal")
        ),
      "Manager did not mount"
    );
    const manager = documents()
      .map(
        /** Capture this invocation's native manager. */ (doc) =>
          doc.querySelector(".kplex-style-manager-modal")
      )
      .find(Boolean);
    c.modals.push(manager);
    if (name) {
      const search = manager.querySelector('input[type="search"]');
      search.value = name;
      search.dispatchEvent(
        new manager.ownerDocument.defaultView.Event("input", { bubbles: true })
      );
      const row = [
        ...manager.querySelectorAll(".kplex-style-manager-row"),
      ].find(
        /** Resolve the exact family when names collide. */ (row) =>
          row.querySelector(".kplex-style-manager-name")?.textContent ===
            name &&
          row.querySelector(".kplex-style-manager-badge")?.textContent ===
            p.translator(
              kind === "tag" ? "styles.legacyTag" : "styles.propertyValue"
            )
      );
      check(row, "Exact style row unavailable");
      row.click();
    } else button(manager, "styles.addStyle").click();
    await until(editor, "Editor did not mount");
    const root = editor();
    c.modals.push(root);
    const select = root.querySelector("select");
    if (!name && select.value !== kind) {
      select.value = kind;
      select.dispatchEvent(
        new root.ownerDocument.defaultView.Event("change", { bubbles: true })
      );
    }
    return root;
  };
  /** Close only the owned manager shells after the editor has reached a durable outcome. */
  const closeManagers = () => {
    for (const root of c.modals)
      if (
        root.isConnected &&
        root.classList.contains("kplex-style-manager-modal")
      )
        root.closest(".modal-container").querySelector(".modal-bg").click();
  };
  /** Read the operation's actual native durable configuration, independent of live settings. */
  const stored = async () => {
    c.inspectingStorage = true;
    try {
      return await p.loadData();
    } finally {
      c.inspectingStorage = false;
    }
  };
  /** Programmatic activation observes real callbacks without claiming trusted pointer/touch delivery. */
  const save = async (root) => {
    button(root, "common.save").click();
    await until(
      /** Observe completion, not a fixed delay. */ () => !root.isConnected,
      "Save did not close"
    );
    closeManagers();
  };

  /** Restore every probe, submitted-write lease and native setting even when an assertion failed. */
  c.cleanup = async () => {
    c.holdDisk = false;
    c.release?.();
    c.release = null;
    c.diskFailure = false;
    c.presentationFailure = false;
    c.managerFailure = false;
    // A submitted write is durable work, not a cancelable DOM draft. Drain it before restoring
    // configuration bytes so its late completion cannot overwrite the restored test-vault data.
    await (app.plugins.plugins["k-plex"]?.settingsWriteQueue ??
      p.settingsWriteQueue);
    await new Promise(
      /** Let the queued editor completion release its pending close exclusion. */ (
        resolve
      ) => window.setTimeout(resolve, 100)
    );
    for (const restore of c.restores.reverse()) restore();
    for (const root of c.modals)
      if (root.isConnected) button(root, "common.cancel")?.click();
    closeManagers();
    const current = app.plugins.plugins["k-plex"];
    if (!current) throw new Error("Plugin disappeared during native cleanup");
    current.settings = c.settings;
    current.savedSettingsPolicy = c.policy;
    if (current === p) {
      p.linkedDocumentLeaf = c.owners.linked;
      p.lastDocumentLeaf = c.owners.last;
      p.recentLeafHistory = c.owners.recent;
      p.sidecarLeaves = c.owners.sidecars;
    }
    if (c.ownsSettings) app.setting.close();
    await current.index.refreshPresentationSettings();
    await app.workspace.changeLayout(c.layout);
    c.cleaned = true;
  };
  /** Execute the serial no-view/active-view and fault matrix, then report facts before retiring the controller. */
  const run = async () => {
    try {
      if (typeof remote.app.show === "function") remote.app.show();
      remote.app.focus({ steal: true });
      native.show();
      native.focus();
      native.webContents.focus();
      await until(
        /** Foreground is a prerequisite, not inferred from a focus API return. */ () =>
          !document.hidden && document.hasFocus(),
        "Selected test window did not foreground"
      );
      await p.activateView();
      await until(
        /** Let normal source-backed startup finish with visible demand before testing its absence. */ () =>
          p.getIndexStatus().upToDate && !p.index.hasSourceBackedStartup(),
        "Initial source startup did not settle"
      );
      for (const type of ["k-plex-react-view", "k-plex-sidepanel-view"])
        for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach();
      await p.settingsWriteQueue;
      await until(
        /** Drain retired native demand before attributing work to the subsequent style operations. */ () =>
          p.index.onDemandTasks.size === 0,
        "Retired demand did not drain"
      );
      let reads = c.counts.reads,
        quietSince = performance.now();
      await until(
        /** Detaching graph tabs can reveal a Markdown renderer; exclude its initial read cascade from the style measurement. */ () => {
          if (reads !== c.counts.reads) {
            reads = c.counts.reads;
            quietSince = performance.now();
          }
          return performance.now() - quietSince >= 250;
        },
        "Native leaf read cascade did not settle"
      );
      const before = { ...c.counts };
      c.noViewBefore = before;
      let root = await open("property");
      root.querySelector(
        'input[aria-label="' + p.translator("styles.propertyValue") + '"]'
      ).value = key;
      c.holdDisk = true;
      button(root, "common.save").click();
      c.submitted = {
        text: root.textContent,
        busy: root.getAttribute("aria-busy"),
        values: [...root.querySelectorAll("input")].map(
          /** Retain synthetic draft facts only, never vault content. */ (
            input
          ) => ({ label: input.getAttribute("aria-label"), value: input.value })
        ),
        connected: root.isConnected,
      };
      await until(
        /** Verify the held native storage boundary. */ () => c.release,
        "Write did not start"
      );
      button(root, "common.save").dispatchEvent(
        new root.ownerDocument.defaultView.Event("click")
      );
      button(root, "common.cancel").dispatchEvent(
        new root.ownerDocument.defaultView.Event("click")
      );
      root.closest(".modal-container").querySelector(".modal-bg").click();
      if (root.ownerDocument === document) {
        native.webContents.sendInputEvent({
          type: "keyDown",
          keyCode: "Escape",
        });
        native.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
      } else
        root.ownerDocument.dispatchEvent(
          new root.ownerDocument.defaultView.KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          })
        );
      await wait(50);
      check(
        root.isConnected && root.getAttribute("aria-busy") === "true",
        "Pending form closed"
      );
      check(!p.settings.noteTypeStyles[key], "Pending style published early");
      check(
        [...root.querySelectorAll("input,select,button")].every(
          (control) => control.disabled
        ),
        "Pending controls remained enabled"
      );
      check(
        c.counts.writes === before.writes + 1,
        "Repeated submissions reached storage"
      );
      c.holdDisk = false;
      c.release();
      c.release = null;
      await until(
        /** Observe the one native completion. */ () => !root.isConnected,
        "Released save did not close"
      );
      closeManagers();
      check(
        (await stored()).noteTypeStyles[key],
        "Property style was not durable"
      );
      passed("no-view create, duplicate clicks and pending Cancel/Escape", {
        writes: 1,
      });

      await p.updateStyleSettings(
        /** Seed imported RGBA spelling; the native color picker exposes only normalized RGB. */
        (draft) => {
          draft.noteTypeStyles[key] = {
            ...draft.noteTypeStyles[key],
            backgroundColor: "#AABBCC80",
            textColor: "#FFEEDD66",
          };
        }
      );
      root = await open("property", key);
      check(
        root.querySelector(
          'input[aria-label="' + p.translator("styles.background") + '"]'
        ).value === "#aabbcc",
        "Native RGB normalization prerequisite differs"
      );
      root.querySelector(
        'input[aria-label="' + p.translator("styles.text") + '"]'
      ).value = "#010203";
      await save(root);
      const rgba = (await stored()).noteTypeStyles[key];
      check(
        rgba.backgroundColor === "#AABBCC80" &&
          rgba.textColor === "#01020366" &&
          rgba.fontSize === undefined,
        "Native appearance edit lost alpha, spelling or inheritance"
      );
      passed(
        "native RGB normalization/edit preserves imported alpha and inheritance"
      );

      root = await open("tag");
      root.querySelector(
        'input[aria-label="' + p.translator("styles.tagPrefix") + '"]'
      ).value = key;
      await save(root);
      check(
        (await stored()).tagNodeStyles["#" + key] &&
          p.settings.noteTypeStyles[key],
        "Tag/property families collided"
      );
      passed("create both style families durably");
      root = await open("property", key);
      root.querySelector(
        'input[aria-label="' + p.translator("styles.propertyValue") + '"]'
      ).value = other;
      await save(root);
      check(
        !p.settings.noteTypeStyles[key] &&
          (await stored()).noteTypeStyles[other],
        "Property rename was not durable"
      );
      passed("rename updates the correct manager family");

      root = await open("property", other);
      c.diskFailure = true;
      button(root, "common.delete").click();
      await until(
        /** Storage failure keeps the current editor live with a safe recovery message. */ () =>
          root.querySelector('[role="status"]')?.textContent ===
          p.translator("styles.operation.notSaved"),
        "Rejected write had no feedback"
      );
      check(
        root.isConnected &&
          p.settings.noteTypeStyles[other] &&
          (await stored()).noteTypeStyles[other],
        "Rejected delete changed durable/live styles"
      );
      c.diskFailure = false;
      button(root, "common.delete").click();
      await until(
        /** Retry completes only the fixed family. */ () => !root.isConnected,
        "Delete retry did not close"
      );
      closeManagers();
      check(
        !(await stored()).noteTypeStyles[other] &&
          p.settings.tagNodeStyles["#" + key],
        "Delete affected the other family"
      );
      passed(
        "failed delete retains draft/live/disk; one retry deletes its family"
      );

      for (const failure of ["presentationFailure", "managerFailure"]) {
        root = await open("tag", "#" + key);
        root.querySelector(
          'input[aria-label="' + p.translator("styles.lucideIcon") + '"]'
        ).value = failure === "managerFailure" ? "info" : "box";
        c[failure] = true;
        await save(root);
        c[failure] = false;
        check(
          (await stored()).tagNodeStyles["#" + key].icon ===
            (failure === "managerFailure" ? "info" : "box"),
          "Saved refresh fault lost durable data"
        );
        check(
          documents().some((doc) =>
            [...doc.querySelectorAll(".notice")].some((notice) =>
              notice.textContent.includes(
                p.translator("styles.operation.savedRefreshPending")
              )
            )
          ),
          "Saved refresh fault had no truthful notice"
        );
        passed("durable " + failure + " closes with saved recovery feedback");
      }
      check(
        c.counts.semantics === before.semantics &&
          c.counts.acquisitions === before.acquisitions &&
          c.counts.sourceReads === before.sourceReads,
        "No-view styles requested unrelated source/semantic work"
      );
      passed(
        "no-view style operations perform no semantic refresh, source acquisition or K-Plex body reads",
        { nativeLeafReads: c.counts.nativeLeafReads - before.nativeLeafReads }
      );

      await p.activateView();
      await until(
        /** Require current ordinary-view readiness before taking active-view owner counters. */ () =>
          app.workspace
            .getLeavesOfType("k-plex-react-view")
            .some((leaf) =>
              leaf.view.contentEl.querySelector(".kplex-role-center")
            ),
        "Active graph did not render"
      );
      await until(
        /** Source-backed startup must settle before a style-only comparison. */ () =>
          p.getIndexStatus().upToDate && !p.index.hasSourceBackedStartup(),
        "Source startup did not settle"
      );
      const pairFiles = p.index
        .allPages()
        .filter(
          /** Prepare genuine physical endpoints without recording their names. */ (
            page
          ) => page.file?.extension === "md"
        )
        .slice(0, 2);
      check(
        pairFiles.length === 2 &&
          (await p.index.prepareRelationshipPair(
            pairFiles[0].path,
            pairFiles[1].path
          )),
        "Selected native pair did not prepare"
      );
      check(
        p.index.isSemanticWriteReady(pairFiles[0].path, pairFiles[1].path),
        "Selected native pair lacks initial authority"
      );
      const activeBefore = { ...c.counts },
        semanticRevision = p.index.semanticPolicyRevision,
        publicationRevision = p.index.publicationRevision;
      root = await open("tag", "#" + key);
      root.querySelector(
        'input[aria-label="' + p.translator("styles.labelPrefix") + '"]'
      ).value = "Style ";
      await save(root);
      check(
        (await stored()).tagNodeStyles["#" + key].prefix === "Style ",
        "Active style edit not durable"
      );
      root = await open("tag");
      root.querySelector(
        'input[aria-label="' + p.translator("styles.tagPrefix") + '"]'
      ).value = key + "_active";
      await save(root);
      check(
        p.index.isSemanticWriteReady(pairFiles[0].path, pairFiles[1].path),
        "Tag priority discarded native relationship editing authority"
      );
      check(
        c.counts.semantics === activeBefore.semantics &&
          c.counts.acquisitions === activeBefore.acquisitions &&
          c.counts.sourceReads === activeBefore.sourceReads,
        "Active styles requested semantic/source work"
      );
      check(
        p.index.semanticPolicyRevision === semanticRevision &&
          p.index.publicationRevision === publicationRevision,
        "Active style edit changed semantic publication"
      );
      passed(
        "active on-demand graph and tag priority retain prepared editing authority without source work",
        { indexingMode: p.settings.indexingMode }
      );

      c.ownsSettings = true;
      p.openSettings();
      await until(
        /** Native Settings may mount in a separate document; await its actual root before navigation. */ () =>
          tab.containerEl.isConnected,
        "Native Settings did not attach"
      );
      /** Navigate the existing declarative subpages through their real native rows. */
      const navigate = async (key) => {
        let row;
        await until(
          /** Reacquire this page's exact localized entry after the previous native render. */ () => {
            row = [
              ...tab.containerEl.ownerDocument.querySelectorAll(
                ".setting-item-name"
              ),
            ]
              .find((element) => element.textContent === p.translator(key))
              ?.closest(".setting-item");
            return row;
          },
          "Native settings entry unavailable: " + key
        );
        row.click();
        await wait(50);
      };
      await navigate("settings.ui.visual.styling");
      await navigate("settings.ui.node.styling");
      await navigate("styles.nodeTitle");
      root = await open("property", null, true);
      const settingsDocument = tab.containerEl.ownerDocument;
      check(
        root.ownerDocument === settingsDocument,
        "Style editor escaped its owning Settings document"
      );
      root.querySelector(
        'input[aria-label="' + p.translator("styles.propertyValue") + '"]'
      ).value = key + "_settings";
      await save(root);
      check(
        (await stored()).noteTypeStyles[key + "_settings"],
        "Owning Settings save was not durable"
      );
      passed(
        "actual Settings subpages and style manager complete in their owning document",
        { popout: settingsDocument !== document }
      );
      app.setting.close();
      c.ownsSettings = false;

      const data = await stored();
      await app.plugins.disablePlugin("k-plex");
      await app.plugins.enablePlugin("k-plex");
      const reloaded = app.plugins.plugins["k-plex"];
      check(
        reloaded.settings.tagNodeStyles["#" + key].prefix ===
          data.tagNodeStyles["#" + key].prefix,
        "Reload lost committed style"
      );
      // Cleanup reacquires the new lifetime; it cannot restore wrappers or settings onto the retired plugin.
      for (const restore of c.restores.reverse()) restore();
      c.restores = [];
      reloaded.settings = c.settings;
      reloaded.savedSettingsPolicy = c.policy;
      await reloaded.index.refreshPresentationSettings();
      await app.workspace.changeLayout(c.layout);
      c.cleaned = true;
      passed("committed style survives native plugin reload");
      c.result = {
        status: "passed",
        cases: c.cases,
        counts: c.counts,
        events: c.events,
        foreground: !document.hidden,
        settingsDocumentDiffers: tab.containerEl.ownerDocument !== document,
      };
    } catch (error) {
      c.error = String(error);
    } finally {
      if (!c.cleaned) {
        try {
          await c.cleanup();
        } catch (error) {
          c.cleanupError = String(error);
        }
      }
      c.done = true;
    }
  };
  window.setTimeout(
    /** Return the initial CLI response before bounded asynchronous native work starts. */ () => {
      void run();
    },
    0
  );
  return true;
}

const report = {
  schemaVersion: 1,
  node: process.version,
  obsidian: cli("version"),
  artifacts,
  status: "running",
  activation: "programmatic native manager/editor DOM",
};
try {
  evaluate("JSON.stringify((" + start.toString() + ")())");
  const end = Date.now() + 180000;
  while (true) {
    await pause(100);
    const state = evaluate(
      "JSON.stringify((()=>{const c=window.__kplex146Styles;return {done:c?.done,error:c?.error,cleanupError:c?.cleanupError,cleaned:c?.cleaned,result:c?.result,submitted:c?.submitted,counts:c?.counts,events:c?.events,cases:c?.cases,noViewBefore:c?.noViewBefore,readFacts:c?.readFacts}})())"
    );
    if (state.done) {
      Object.assign(report, state);
      assert(!state.error, state.error);
      assert(!state.cleanupError, state.cleanupError);
      assert(state.cleaned);
      report.status = "passed";
      break;
    }
    assert(Date.now() < end, "Style matrix deadline expired");
  }
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  process.exitCode = 1;
} finally {
  try {
    evaluate(
      "JSON.stringify((()=>{const c=window.__kplex146Styles;if(c&&!c.done){c.cancelled=true;c.holdDisk=false;c.release?.();}return true})())"
    );
    const end = Date.now() + 20000;
    while (
      !evaluate(
        "JSON.stringify(!window.__kplex146Styles||window.__kplex146Styles.done)"
      )
    ) {
      assert(Date.now() < end, "Cleanup deadline expired");
      await pause(100);
    }
    evaluate("JSON.stringify(delete window.__kplex146Styles)");
  } catch (error) {
    report.status = "failed";
    report.cleanupFailure = String(error);
    process.exitCode = 1;
  }
  for (const saved of bytes) writeFileSync(saved.path, saved.bytes);
  report.configurationRestored = bytes.every((saved) =>
    readFileSync(saved.path).equals(saved.bytes)
  );
  writeFileSync(
    join(output, "style-operations-native.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
}
console.log(
  JSON.stringify({
    status: report.status,
    cases: report.result?.cases.length,
    error: report.error,
    cleanupFailure: report.cleanupFailure,
    configurationRestored: report.configurationRestored,
  })
);
