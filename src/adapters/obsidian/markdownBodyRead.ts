/**
 * Markdown body reads for K-Plex indexing (Obsidian adapter).
 *
 * Obsidian's `Vault.read` and `Vault.cachedRead` keep the text of each Markdown file up to the
 * vault's content-cache limit (64K characters) in memory until Obsidian replaces or drops that
 * entry or the `TFile` goes away. That suits editors and previews, but K-Plex reads every note
 * body when it scans for web links or builds the full index. Through those calls most of the
 * vault's text would stay live in the renderer after the scan (measured: about 82 MB after the
 * web-link scan of an 11,600-note vault). Index reads therefore go through the public `DataAdapter`, which does not
 * populate that cache, and drop a leading byte-order mark exactly as `Vault.read` does.
 *
 * Edits still reach the index through Obsidian's metadata events after the file is saved, so the
 * saved text is what both paths would return.
 */
import type { DataAdapter, TFile } from "obsidian";

/** U+FEFF, which `Vault.read` strips from the start of a file. */
const BYTE_ORDER_MARK = 0xfeff;

/**
 * Read one Markdown body for indexing without adding it to Obsidian's content cache.
 *
 * @param adapter - the vault's data adapter (`app.vault.adapter`)
 * @param file - the Markdown file whose body is read
 * @returns the file text, without a leading byte-order mark
 */
export async function readMarkdownBodyForIndex(adapter: Pick<DataAdapter, "read">, file: Pick<TFile, "path">): Promise<string> {
  const text = await adapter.read(file.path);
  return text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
}
