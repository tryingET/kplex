/**
 * Startup timing policy for K-Plex's once-per-session index (application layer, host-free).
 *
 * The session index restores the persisted semantic snapshot, primes the physical search catalog,
 * builds the whole-vault baseline and scans every Markdown body for web links. In a large vault this
 * retains a few hundred megabytes of renderer heap even while no K-Plex view is open. This policy
 * decides, once at layout-ready, when that work starts. The Obsidian composition root supplies the
 * plain facts; the policy never reads the host, schedules work or touches graph state.
 *
 * - `now`: the restored workspace already opened a K-Plex view, so the user is waiting for it.
 * - `idle`: desktop with no open view. Start when the host next reports idle time, after Obsidian
 *   and other plugins finished their own startup; the index is usually still warm before first use.
 * - `on-open`: mobile with no open view. Start only when a K-Plex view is first opened. A mobile
 *   WebView has a much smaller memory budget, and a hidden whole-vault index competes there with
 *   the editor and other plugins without serving anyone (compare the iOS large-vault deferral).
 *
 * A view opened after layout-ready always starts the session index through the view-open path.
 */
export type StartupIndexTiming = "now" | "idle" | "on-open";

/** Upper bound for the desktop idle wait, so a continuously busy window still prepares the index. */
export const STARTUP_INDEX_IDLE_TIMEOUT_MS = 10_000;

/** Plain host facts observed at layout-ready. */
export interface StartupIndexFacts {
  /** Obsidian Mobile (Android or iOS phone/tablet). */
  readonly mobile: boolean;
  /** A K-Plex view was opened or is visible in the restored workspace. */
  readonly viewOpen: boolean;
}

/**
 * Choose when the once-per-session index starts.
 *
 * @param facts - host facts captured once at layout-ready
 * @returns `now` when a view is waiting, otherwise `idle` on desktop and `on-open` on mobile
 */
export function startupIndexTiming(facts: StartupIndexFacts): StartupIndexTiming {
  if (facts.viewOpen) return "now";
  return facts.mobile ? "on-open" : "idle";
}
