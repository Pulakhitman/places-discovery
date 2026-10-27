/**
 * IDs available from Places API (New) responses.
 * Maps scrape-style `data_id` (0x…:0x…) is not returned by the official API.
 */

/** Extract a CID from a Google Maps URI when Places includes `?cid=` / `&cid=`. */
export function extractCidFromMapsUri(uri: string | undefined): string | null {
  if (!uri?.trim()) {
    return null;
  }
  try {
    const url = new URL(uri);
    const cid = url.searchParams.get("cid")?.trim();
    if (cid && /^\d+$/.test(cid)) {
      return cid;
    }
  } catch {
    // Fall through to regex for odd absolute paths.
  }
  const match = uri.match(/[?&]cid=(\d+)/i);
  return match?.[1] ?? null;
}

/** Places API (New) resource name form. */
export function placesResourceName(placeId: string): string {
  const id = placeId.replace(/^places\//, "").trim();
  return id ? `places/${id}` : "";
}
