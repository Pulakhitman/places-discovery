import { haversineMeters, nameSimilarity } from "@/lib/places/google-match";
import type { FoursquareMatch, FoursquarePlace, FoursquareTimeWindow } from "@/lib/places/foursquare-types";

const BASE = "https://places-api.foursquare.com/places";
const VERSION = "2025-06-17";
// Premium fields are requested ONLY after a separate user action. Never request photos.
export const PREMIUM_FIELDS = [
  "fsq_place_id", "name", "latitude", "longitude", "categories", "location", "tel", "email",
  "website", "social_media", "link", "chains", "description", "rating", "hours", "hours_popular",
  "popularity", "price", "attributes", "stats", "menu", "place_actions", "tastes", "tips", "veracity_rating",
].join(",");

export class FoursquareError extends Error {
  constructor(public readonly status: number) {
    super(status === 429 ? "Foursquare rate limit reached. Please try later." : "Foursquare Places request failed.");
  }
}

export function foursquareConfigured(): boolean {
  return Boolean(process.env.FOURSQUARE_SERVICE_KEY?.trim());
}

export function validateFoursquareInput(value: unknown): { name: string; lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 120 || /[\u0000-\u001f]/.test(input.name)) return null;
  if (typeof input.lat !== "number" || !Number.isFinite(input.lat) || Math.abs(input.lat) > 90) return null;
  if (typeof input.lng !== "number" || !Number.isFinite(input.lng) || Math.abs(input.lng) > 180) return null;
  return { name: input.name.trim(), lat: input.lat, lng: input.lng };
}

export function validFoursquareId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max = 500): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}
function number(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}
export function safeFoursquareUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value.slice(0, 25) : []; }
function windows(value: unknown): FoursquareTimeWindow[] {
  return list(value).flatMap((v) => {
    const w = record(v);
    return Number.isInteger(w.day) && typeof w.day === "number" && w.day >= 1 && w.day <= 7 &&
      typeof w.open === "string" && typeof w.close === "string" && /^\d{2}:?\d{2}$/.test(w.open) && /^\d{2}:?\d{2}$/.test(w.close)
      ? [{ day: w.day, open: w.open, close: w.close }] : [];
  });
}

/** Explicit allowlist: photos and provider metadata are never returned to the browser. */
export function mapFoursquarePlace(raw: unknown): FoursquarePlace | null {
  const p = record(raw);
  if (!validFoursquareId(p.fsq_place_id) || !text(p.name, 120)) return null;
  const lat = number(p.latitude, -90, 90);
  const lng = number(p.longitude, -180, 180);
  if (lat === undefined || lng === undefined) return null;
  const loc = record(p.location), social = record(p.social_media), hours = record(p.hours);
  const attributes = record(p.attributes), stats = record(p.stats);
  const tags = Object.entries(attributes).filter(([, v]) => v === true || (typeof v === "string" && v.length > 0)).map(([key, v]) => `${key.replace(/_/g, " ")}${typeof v === "string" ? `: ${v.slice(0, 60)}` : ""}`);
  return {
    id: p.fsq_place_id, name: text(p.name, 120)!, lat, lng,
    link: safeFoursquareUrl(p.link) ?? `https://foursquare.com/v/${encodeURIComponent(p.fsq_place_id)}`,
    categories: list(p.categories).map((c) => text(record(c).name, 80)).filter((x): x is string => Boolean(x)),
    chains: list(p.chains).map((c) => text(record(c).name, 80)).filter((x): x is string => Boolean(x)),
    address: text(loc.formatted_address, 250) ?? ([loc.address, loc.locality, loc.region, loc.postcode, loc.country].map((v) => text(v, 80)).filter(Boolean).join(", ") || undefined),
    phone: text(p.tel, 80), email: text(p.email, 150), website: safeFoursquareUrl(p.website),
    social: { facebook: text(social.facebook_id, 100), instagram: text(social.instagram, 100), twitter: text(social.twitter, 100) },
    description: text(p.description, 2000), rating: number(p.rating, 0, 10), popularity: number(p.popularity, 0, 1),
    price: number(p.price, 1, 4),
    hours: Object.keys(hours).length ? { display: text(hours.display, 500), openNow: typeof hours.open_now === "boolean" ? hours.open_now : undefined, regular: windows(hours.regular) } : undefined,
    popularWindows: windows(p.hours_popular), tags,
    stats: { ratings: number(stats.total_ratings, 0, 1e12), tips: number(stats.total_tips, 0, 1e12), photos: number(stats.total_photos, 0, 1e12) },
    menu: safeFoursquareUrl(p.menu),
    actions: list(p.place_actions).flatMap((item) => { const action = record(item); const url = safeFoursquareUrl(action.url); return url ? [{ label: text(action.action, 80) ?? "Action", url }] : []; }),
    tastes: list(p.tastes).map((v) => text(v, 100)).filter((x): x is string => Boolean(x)),
    tips: list(p.tips).map((v) => text(record(v).text, 500)).filter((x): x is string => Boolean(x)),
    veracity: number(p.veracity_rating, 1, 5),
  };
}

export function matchFoursquareResults(results: unknown, input: { name: string; lat: number; lng: number }): FoursquareMatch | null {
  const candidates = list(results).map(mapFoursquarePlace).filter((x): x is FoursquarePlace => Boolean(x));
  const ranked = candidates.flatMap((place) => {
    const distanceM = Math.round(haversineMeters(input.lat, input.lng, place.lat, place.lng));
    const similarity = nameSimilarity(input.name, place.name);
    return distanceM <= 150 && similarity >= 0.6 ? [{ place, distanceM, nameSimilarity: Math.round(similarity * 100) / 100, confidence: similarity >= 0.8 && distanceM <= 75 ? "strong" as const : "weak" as const }] : [];
  });
  return ranked.sort((a, b) => b.nameSimilarity - a.nameSimilarity || a.distanceM - b.distanceM)[0] ?? null;
}

async function requestFoursquare(url: URL): Promise<unknown> {
  const key = process.env.FOURSQUARE_SERVICE_KEY?.trim();
  if (!key) throw new FoursquareError(503);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, "X-Places-Api-Version": VERSION, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(9000) });
  } catch { throw new FoursquareError(504); }
  if (!response.ok) throw new FoursquareError(response.status);
  try { return await response.json() as unknown; } catch { throw new FoursquareError(502); }
}

/** Search with default Pro fields only. No Premium request or implicit details fetch. */
export async function searchFoursquare(input: { name: string; lat: number; lng: number }): Promise<FoursquareMatch | null> {
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("query", input.name);
  url.searchParams.set("ll", `${input.lat},${input.lng}`);
  url.searchParams.set("radius", "400");
  url.searchParams.set("limit", "5");
  const payload = record(await requestFoursquare(url));
  return matchFoursquareResults(payload.results, input);
}

/** Premium costs money; caller must explicitly request this after a Pro match. */
export async function getFoursquarePremium(match: FoursquareMatch): Promise<FoursquarePlace> {
  if (!validFoursquareId(match.place.id)) throw new FoursquareError(400);
  const url = new URL(`${BASE}/${encodeURIComponent(match.place.id)}`);
  url.searchParams.set("fields", PREMIUM_FIELDS);
  const place = mapFoursquarePlace(await requestFoursquare(url));
  if (!place || place.id !== match.place.id || haversineMeters(place.lat, place.lng, match.place.lat, match.place.lng) > 150) throw new FoursquareError(502);
  return place;
}
