/**
 * Surface-owned native-menu coordinates. Read current control geometry only at invocation; hidden,
 * detached or foreign controls fall back inside the same visible Plex. The native Menu still owns
 * menu-size viewport clamping, rendering and dismissal. No event or anchor survives the call.
 */

/** Resolve a fresh visible control anchor, or a bounded in-pane fallback; disposed roots cannot open menus. */
export function toolbarMenuAnchor(root: HTMLElement | null, control: HTMLElement | null): {
  position: { x: number; y: number };
  ownerDocument: Document;
} | null {
  if (!root?.isConnected || !root.getClientRects().length) return null;
  const ownerDocument = root.ownerDocument, viewWindow = ownerDocument.defaultView;
  if (!viewWindow || viewWindow.getComputedStyle(root).visibility !== "visible") return null;
  const bounds = root.getBoundingClientRect();
  const left = Math.max(0, bounds.left), top = Math.max(0, bounds.top);
  const right = Math.min(viewWindow.innerWidth, bounds.right), bottom = Math.min(viewWindow.innerHeight, bounds.bottom);
  if (right <= left || bottom <= top) return null;
  // Native Menu clamps its own dimensions; keep the seed point inside this visible surface too.
  const maxX = Math.max(left, right - 1), maxY = Math.max(top, bottom - 1);
  if (control?.isConnected && control.ownerDocument === ownerDocument && root.contains(control)
    && control.getClientRects().length && viewWindow.getComputedStyle(control).visibility === "visible") {
    const anchor = control.getBoundingClientRect();
    if (anchor.width > 0 && anchor.height > 0 && anchor.right > left && anchor.left < right
      && anchor.bottom > top && anchor.top < bottom) {
      return { position: { x: Math.min(maxX, Math.max(left, anchor.left)), y: Math.min(maxY, Math.max(top, anchor.bottom + 4)) }, ownerDocument };
    }
  }
  return { position: { x: Math.min(maxX, left + 40), y: Math.min(maxY, top + 40) }, ownerDocument };
}
