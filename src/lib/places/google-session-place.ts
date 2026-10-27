/**
 * Session-only Google placeId reuse (Phase 3).
 * Stores place ids + match metadata — never review text.
 */

import type { GoogleMatchInfo } from "./google-match";

const PREFIX = "pd:gplace:";

export type SessionGooglePlace = {
  placeId: string;
  googleName: string;
  match: GoogleMatchInfo;
};

function keyForOsmPlace(osmPlaceId: string): string {
  return `${PREFIX}${osmPlaceId}`;
}

export function readSessionGooglePlace(
  osmPlaceId: string,
): SessionGooglePlace | null {
  if (typeof window === "undefined" || !osmPlaceId) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(keyForOsmPlace(osmPlaceId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionGooglePlace;
    if (!parsed?.placeId || !parsed?.match) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionGooglePlace(
  osmPlaceId: string,
  value: SessionGooglePlace,
): void {
  if (typeof window === "undefined" || !osmPlaceId || !value.placeId) {
    return;
  }
  try {
    sessionStorage.setItem(
      keyForOsmPlace(osmPlaceId),
      JSON.stringify({
        placeId: value.placeId,
        googleName: value.googleName,
        match: value.match,
      }),
    );
  } catch {
    // Quota / private mode — ignore; lookup still works without reuse.
  }
}

export function clearSessionGooglePlace(osmPlaceId: string): void {
  if (typeof window === "undefined" || !osmPlaceId) {
    return;
  }
  try {
    sessionStorage.removeItem(keyForOsmPlace(osmPlaceId));
  } catch {
    // ignore
  }
}
