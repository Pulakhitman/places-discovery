/** Session-only Google Place ID reuse; never persist Google's names or match metadata. */
const PREFIX = "pd:gplace:";

function keyForOsmPlace(osmPlaceId: string): string {
  return `${PREFIX}${osmPlaceId}`;
}

export function readSessionGooglePlace(osmPlaceId: string): string | null {
  if (typeof window === "undefined" || !osmPlaceId) return null;
  try {
    const raw = sessionStorage.getItem(keyForOsmPlace(osmPlaceId));
    if (!raw) return null;
    // Migrate old records without retaining their Google name or match object.
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { placeId?: unknown };
      const id = typeof parsed.placeId === "string" ? parsed.placeId.trim() : "";
      if (id) sessionStorage.setItem(keyForOsmPlace(osmPlaceId), id);
      else sessionStorage.removeItem(keyForOsmPlace(osmPlaceId));
      return id || null;
    }
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export function writeSessionGooglePlace(osmPlaceId: string, placeId: string): void {
  if (typeof window === "undefined" || !osmPlaceId || !placeId.trim()) return;
  try {
    sessionStorage.setItem(keyForOsmPlace(osmPlaceId), placeId.trim());
  } catch {
    // Quota / private mode — lookup still works without reuse.
  }
}

export function clearSessionGooglePlace(osmPlaceId: string): void {
  if (typeof window === "undefined" || !osmPlaceId) return;
  try {
    sessionStorage.removeItem(keyForOsmPlace(osmPlaceId));
  } catch {
    // ignore
  }
}
