import type { GooglePlaceDetails } from "./google-types";

type CacheEntry = {
  expiresAt: number;
  details: GooglePlaceDetails;
};

const store = new Map<string, CacheEntry>();

function ttlMs(): number {
  const raw = process.env.GOOGLE_PLACES_DETAILS_CACHE_TTL_MS;
  const n = raw ? Number(raw) : 15 * 60_000;
  return Number.isFinite(n) && n >= 0 ? n : 15 * 60_000;
}

/** In-memory Place Details cache (TTL). Not persisted; reduces repeat billable opens. */
export function getCachedGoogleDetails(
  placeId: string,
): GooglePlaceDetails | null {
  const id = placeId.replace(/^places\//, "").trim();
  if (!id) {
    return null;
  }
  const hit = store.get(id);
  if (!hit) {
    return null;
  }
  if (Date.now() > hit.expiresAt) {
    store.delete(id);
    return null;
  }
  return hit.details;
}

export function setCachedGoogleDetails(details: GooglePlaceDetails): void {
  const ttl = ttlMs();
  if (ttl === 0) {
    return;
  }
  store.set(details.placeId, {
    details,
    expiresAt: Date.now() + ttl,
  });
}

/** Test helper */
export function clearGoogleDetailsCache(): void {
  store.clear();
}
