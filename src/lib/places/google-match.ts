/** OSM ↔ Google name/distance match helpers (official API match only). */

export type MatchConfidence = "strong" | "weak";

export type GoogleMatchInfo = {
  confidence: MatchConfidence;
  distanceM: number;
  nameSimilarity: number;
  queriedName: string;
  googleName: string;
};

const STRONG_MIN_SIMILARITY = 0.45;
const STRONG_MAX_DISTANCE_M = 250;

export function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dice coefficient on character bigrams — good enough for short place names. */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizePlaceName(a);
  const right = normalizePlaceName(b);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (left.includes(right) || right.includes(left)) {
    return 0.85;
  }

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };

  const A = bigrams(left);
  const B = bigrams(right);
  if (A.size === 0 || B.size === 0) {
    return left[0] === right[0] ? 0.2 : 0;
  }

  let overlap = 0;
  for (const [g, count] of A) {
    const other = B.get(g);
    if (other) {
      overlap += Math.min(count, other);
    }
  }
  const total = [...A.values()].reduce((s, n) => s + n, 0) +
    [...B.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function scoreGoogleMatch(params: {
  queriedName: string;
  googleName: string;
  queryLat: number;
  queryLng: number;
  googleLat: number;
  googleLng: number;
}): GoogleMatchInfo {
  const distanceM = Math.round(
    haversineMeters(
      params.queryLat,
      params.queryLng,
      params.googleLat,
      params.googleLng,
    ),
  );
  const similarity = nameSimilarity(params.queriedName, params.googleName);
  const confidence: MatchConfidence =
    similarity >= STRONG_MIN_SIMILARITY && distanceM <= STRONG_MAX_DISTANCE_M
      ? "strong"
      : "weak";

  return {
    confidence,
    distanceM,
    nameSimilarity: Math.round(similarity * 100) / 100,
    queriedName: params.queriedName,
    googleName: params.googleName,
  };
}
