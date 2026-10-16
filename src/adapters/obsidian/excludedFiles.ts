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
 * tested with a trailing slash. The vault root is never excluded. Obsidian caches each answer per
 * path and clears that cache when the filter list changes.
 */
import type { App, TFile } from "obsidian";

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
  return hasUserIgnoreProbe(metadataCache) && metadataCache.isUserIgnored(path) === true;
}

/**
 * Whether a folder is on Obsidian's excluded-files list; the vault root never is.
 *
 * @param metadataCache - Obsidian's metadata cache
 * @param path - vault-relative folder path (`""` or `"/"` for the root)
 * @returns true only when Obsidian reports the folder (as a path prefix) as excluded
 */
export function isExcludedFolder(metadataCache: object, path: string): boolean {
  if (path === "" || path === "/") return false;
  return hasUserIgnoreProbe(metadataCache) && metadataCache.isUserIgnored(`${path}/`) === true;
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
