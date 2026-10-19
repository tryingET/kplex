/**
 * Obsidian's "Excluded files" (Settings → Files and links) for K-Plex indexing (Obsidian adapter).
 *
 * Obsidian hides excluded files from search, the graph view and unlinked mentions. K-Plex follows
 * the graph view: an excluded file or folder has no node, links and ontology/date references to it
 * are dropped (never turned into placeholders, because the file exists), its tags do not count and
 * its body is never read. In vaults that keep generated material, templates or code under excluded
 * folders this removes most of the index.
 *
 * Obsidian exposes its compiled filter list as `MetadataCache.isUserIgnored(path)`, which is not
 * part of the public typings. It is feature-detected here; without it nothing is excluded, which is
 * the previous behaviour. Plain filters are path prefixes such as `Archive/`, so folder paths are
 * tested with a trailing slash. A folder the list matches excludes everything inside it, also for a
 * folder-only regular expression such as `/^Archive\/$/`; so the tree walk, which skips an excluded
 * folder's subtree, and every flat file list agree. The vault root is never excluded. Obsidian
 * caches each answer per path and clears that cache when the filter list changes; it keeps the
 * configured list as JSON in `MetadataCache.userIgnoreFiltersString`, also undocumented.
 *
 * K-Plex's persistent index cache never outlives a list: it records the list it was built under in
 * Obsidian's vault-local storage, and a cache built under another list is discarded once before it
 * opens (`indexCacheExclusionEpoch()`). A change during a session marks the record stale through
 * Obsidian's undocumented `config-changed` Vault event, which its MetadataCache also listens to.
 */
import type { App, EventRef, Events, TFile } from "obsidian";

/** Vault-local storage key recording the excluded-files list K-Plex's index cache was built under. */
const INDEX_CACHE_LIST_KEY = "k-plex-index-excluded-files";
/** Recorded after an in-session list change; differs from every list Obsidian can report. */
const INDEX_CACHE_LIST_STALE = "stale";

/** The undocumented MetadataCache member that applies Obsidian's excluded-file filters. */
interface UserIgnoreProbe {
  isUserIgnored(path: string): boolean;
}

/**
 * Detect Obsidian's ignore filter on a metadata cache (or a narrow host double).
 *
 * @param metadataCache - Obsidian's metadata cache or an adapter host's narrow view of it
 * @returns whether `isUserIgnored` can be called
 */
function hasUserIgnoreProbe(metadataCache: object): metadataCache is UserIgnoreProbe {
  // Narrow host doubles may omit the cache entirely; treat that like a host without the filter.
  return typeof metadataCache === "object" && metadataCache !== null
    && typeof Reflect.get(metadataCache, "isUserIgnored") === "function";
}

/**
 * Whether a file path is on Obsidian's excluded-files list.
 *
 * @param metadataCache - Obsidian's metadata cache
 * @param path - vault-relative file path
 * @returns true only when Obsidian reports the path as excluded
 */
export function isExcludedFile(metadataCache: object, path: string): boolean {
  if (!hasUserIgnoreProbe(metadataCache)) return false;
  return metadataCache.isUserIgnored(path) === true || hasExcludedAncestor(metadataCache, path);
}

/**
 * Whether a folder is on Obsidian's excluded-files list; the vault root never is.
 *
 * @param metadataCache - Obsidian's metadata cache
 * @param path - vault-relative folder path (`""` or `"/"` for the root)
 * @returns true only when Obsidian reports the folder (as a path prefix) as excluded
 */
export function isExcludedFolder(metadataCache: object, path: string): boolean {
  if (path === "" || path === "/" || !hasUserIgnoreProbe(metadataCache)) return false;
  return metadataCache.isUserIgnored(`${path}/`) === true || hasExcludedAncestor(metadataCache, path);
}

/**
 * Whether any folder above a path is excluded (each tested as `folder/`).
 *
 * @param metadataCache - a metadata cache with Obsidian's ignore filter
 * @param path - vault-relative file or folder path
 * @returns true when an ancestor folder is on the list
 */
function hasExcludedAncestor(metadataCache: UserIgnoreProbe, path: string): boolean {
  for (let slash = path.indexOf("/"); slash > 0; slash = path.indexOf("/", slash + 1)) {
    if (metadataCache.isUserIgnored(path.slice(0, slash + 1)) === true) return true;
  }
  return false;
}

/**
 * Whether a K-Plex node path names an excluded vault file or folder. Folder nodes are read through
 * their `folder:` prefix here, at the host boundary. Tags, URLs and unresolved names are not vault
 * files and are never excluded, even when a regular expression on the list matches their text.
 *
 * @param app - the host app (vault and metadata cache)
 * @param path - a K-Plex node path such as `Notes/A.md` or `folder:Archive`
 * @returns true only for an existing file or folder on the list
 */
export function isExcludedNodePath(app: Pick<App, "vault" | "metadataCache">, path: string): boolean {
  if (path.startsWith("folder:")) {
    const folderPath = path.slice("folder:".length);
    return app.vault.getFolderByPath(folderPath) !== null && isExcludedFolder(app.metadataCache, folderPath);
  }
  return app.vault.getFileByPath(path) !== null && isExcludedFile(app.metadataCache, path);
}

/**
 * Obsidian's configured excluded-files list as an opaque key, for observations that must change
 * when the list changes (a source's resolution environment). An empty or unavailable list has no
 * key, so observations made without a list keep their previous value.
 *
 * @param metadataCache - Obsidian's metadata cache
 * @returns the list's JSON text, or null when there is no list
 */
export function excludedFilesListKey(metadataCache: object): string | null {
  if (!hasUserIgnoreProbe(metadataCache)) return null;
  const key: unknown = Reflect.get(metadataCache, "userIgnoreFiltersString");
  return typeof key === "string" && key !== "" && key !== "null" && key !== "[]" ? key : null;
}

/** Whether K-Plex's persistent index cache follows the current excluded-files list. */
export interface IndexCacheExclusionEpoch {
  /** True when the cache was built under the current list, or no list was ever recorded and none is set. */
  matches(): boolean;
  /** Record that the cache now follows the current list. */
  adopt(): void;
  /** Record that the list changed, so the next start discards the cache. */
  invalidate(): void;
}

/**
 * The excluded-files epoch of K-Plex's persistent index cache on this device. A cache from before
 * K-Plex honoured the list (nothing recorded) is kept only when no list is set.
 *
 * @param app - the host app (metadata cache and vault-local storage)
 * @returns the epoch, or null when the host has no excluded-files filter or no vault-local storage
 */
export function indexCacheExclusionEpoch(app: Pick<App, "metadataCache" | "loadLocalStorage" | "saveLocalStorage">): IndexCacheExclusionEpoch | null {
  if (!hasUserIgnoreProbe(app.metadataCache) || typeof app.loadLocalStorage !== "function" || typeof app.saveLocalStorage !== "function") return null;
  const current = (): string => excludedFilesListKey(app.metadataCache) ?? "";
  return {
    matches: () => {
      const recorded: unknown = app.loadLocalStorage(INDEX_CACHE_LIST_KEY), list = current();
      return recorded === list || (recorded === null && list === "");
    },
    adopt: () => app.saveLocalStorage(INDEX_CACHE_LIST_KEY, current()),
    invalidate: () => app.saveLocalStorage(INDEX_CACHE_LIST_KEY, INDEX_CACHE_LIST_STALE),
  };
}

/**
 * Observe changes of Obsidian's excluded-files list. Obsidian's Vault reports every changed app
 * setting through its undocumented `config-changed` event; this one is `userIgnoreFilters`.
 *
 * @param vault - the vault, as the event source
 * @param callback - called after the list changed
 * @returns the event reference to register with the plugin
 */
export function onExcludedFilesListChanged(vault: Events, callback: () => void): EventRef {
  return vault.on("config-changed", (key: unknown) => { if (key === "userIgnoreFilters") callback(); });
}

/**
 * The Markdown files K-Plex indexes: `Vault.getMarkdownFiles()` without excluded files.
 *
 * @param app - the host app (vault and metadata cache)
 * @returns Markdown files that are not excluded, in vault order
 */
export function indexedMarkdownFiles(app: Pick<App, "vault" | "metadataCache">): TFile[] {
  return withoutExcluded(app, app.vault.getMarkdownFiles());
}

/**
 * The files K-Plex indexes: `Vault.getFiles()` without excluded files.
 *
 * @param app - the host app (vault and metadata cache)
 * @returns files that are not excluded, in vault order
 */
export function indexedFiles(app: Pick<App, "vault" | "metadataCache">): TFile[] {
  return withoutExcluded(app, app.vault.getFiles());
}

/**
 * Drop excluded files from a host file list; returns the same array when nothing is excluded.
 *
 * @param app - the host app whose metadata cache owns the filter
 * @param files - host files to filter
 * @returns the non-excluded files
 */
function withoutExcluded(app: Pick<App, "metadataCache">, files: TFile[]): TFile[] {
  if (!hasUserIgnoreProbe(app.metadataCache)) return files;
  const kept = files.filter((file) => !isExcludedFile(app.metadataCache, file.path));
  return kept.length === files.length ? files : kept;
}
