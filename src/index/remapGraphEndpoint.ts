/**
 * Synchronous legacy graph-coordinate remapping shared by the canonical repository and bounded
 * retained read scopes. Native identity/migration decisions remain GraphIndex-owned; existing
 * evidence and resolver owners preserve provenance, precedence and reverse incidence.
 */
import type { GraphPage } from "../types";
import type { GraphState } from "./GraphState";
import { resolveEvidencePair } from "./RelationResolver";

/**
 * Move one already-validated endpoint inside its own graph owner, preserving its page identity.
 * The caller validates native/collision identity and supplies physical/name fields. No I/O, source
 * certification or notification occurs; reverse keys resolve against this owner's pages only.
 */
export function remapGraphEndpoint(state: Pick<GraphState, "pages" | "evidence">, oldPath: string,
  newPath: string, update: (page: GraphPage) => void): void {
  const page = state.pages.get(oldPath)!;
  const collision = state.pages.get(newPath);
  const affected = new Set<string>(page.neighbours.keys());
  for (const item of state.evidence.declarationsTouching(oldPath)) {
    affected.add(item.declaredByPath); affected.add(item.declaredTargetPath);
  }
  if (collision && collision !== page) {
    for (const path of collision.neighbours.keys()) affected.add(path);
    for (const item of state.evidence.declarationsTouching(newPath)) {
      affected.add(item.declaredByPath); affected.add(item.declaredTargetPath);
    }
  }
  for (const path of state.evidence.renamePath(oldPath, newPath)) affected.add(path);
  state.pages.delete(oldPath); state.pages.delete(newPath);
  page.path = newPath; update(page); page.neighbours.clear(); state.pages.set(newPath, page);
  for (const rawPath of affected) {
    const path = rawPath === oldPath ? newPath : rawPath;
    if (path === newPath) continue;
    const target = state.pages.get(path);
    if (!target || target === page) continue;
    target.neighbours.delete(oldPath); target.neighbours.delete(newPath);
    resolveEvidencePair(state.pages, state.evidence, newPath, path);
    resolveEvidencePair(state.pages, state.evidence, path, newPath);
  }
}
