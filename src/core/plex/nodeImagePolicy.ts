/**
 * Presentation-only consent policy for resolved node image destinations. The existing host link
 * resolver still owns accepted property syntax and local attachment resolution. This policy performs
 * no I/O and is shared by resolution and the final image DOM boundary; it grants no web-embed consent.
 */

/** Recognize HTTP(S) destinations after link resolution, including decoded/local-looking values. */
export function isRemoteNodeImageSource(source: string): boolean {
  return /^https?:\/\//i.test(source.trim());
}

/**
 * Check the resolved destination (remote URL or Vault file path), never the host-generated resource
 * URL used to display a local attachment. Only an explicit boolean opt-in permits remote imagery.
 */
export function canDisplayNodeImage(destination: string, allowRemoteNodeImages: boolean): boolean {
  return !isRemoteNodeImageSource(destination) || allowRemoteNodeImages === true;
}
