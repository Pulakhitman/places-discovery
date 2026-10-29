import { haversineMeters, nameSimilarity } from "@/lib/places/google-match";
import type { BestTimeDay, BestTimeForecast, BestTimeIdentity, BestTimeInput, BestTimeLive } from "@/lib/places/besttime-types";

const BASE = "https://besttime.app/api/v1/forecasts";
const DAYS = 7;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function string(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value) ? value.trim() : null;
}
function number(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** An OSM address needs a street-level identifier, not just a city or region. */
export function preciseOsmAddress(tags: unknown, address: unknown): string | null {
  const t = object(tags);
  const candidate = string(address, 500);
  const street = string(t["addr:street"], 150) ?? string(t["contact:street"], 150) ?? string(t["addr:road"], 150) ?? string(t["addr:place"], 150);
  const house = string(t["addr:housenumber"], 50) ?? string(t["contact:housenumber"], 50) ?? string(t["addr:housename"], 150);
  const full = string(t["addr:full"], 500) ?? string(t["contact:full"], 500);
  if (!candidate || (!street && !full) || (!house && !full)) return null;
  return candidate;
}

export function validateBestTimeInput(value: unknown): BestTimeInput | null {
  const v = object(value);
  if (v.source !== "osm" || v.isUnnamed !== false || v.googlePlaceId !== undefined || object(v.sources).google === true || object(v.sources).osm !== true || !/^osm:(node|way|relation)\/\d+$/.test(String(v.id ?? ""))) return null;
  const name = string(v.name, 120);
  const address = preciseOsmAddress(v.tags, v.address);
  const lat = number(v.lat, -90, 90);
  const lng = number(v.lng, -180, 180);
  return name && address && lat !== null && lng !== null ? { name, address, lat, lng } : null;
}

export function forecastHour(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 23) throw new RangeError("Invalid forecast hour index");
  const hour = (6 + index) % 24;
  return `${String(hour).padStart(2, "0")}:00${index >= 18 ? " +1" : ""}`;
}

export function matchBestTime(info: unknown, input: BestTimeInput): BestTimeIdentity | null {
  const v = object(info);
  const name = string(v.venue_name, 256);
  const address = string(v.venue_address, 1024);
  const lat = number(v.venue_lat, -90, 90);
  const lng = number(v.venue_lon, -180, 180) ?? number(v.venue_lng, -180, 180);
  if (!name || !address || lat === null || lng === null) return null;
  const distanceM = Math.round(haversineMeters(input.lat, input.lng, lat, lng));
  const similarity = nameSimilarity(input.name, name);
  // The geocoded address must corroborate the OSM street/house number too.
  const osmTokens = input.address.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const venueAddress = address.toLowerCase();
  const houseNumber = osmTokens.find((token) => /^\d+[a-z]?$/i.test(token));
  if (houseNumber && !new RegExp(`\\b${houseNumber}\\b`, "i").test(venueAddress)) return null;
  if (distanceM > 150 || similarity < 0.6) return null;
  return { name, address, lat, lng, distanceM, nameSimilarity: Math.round(similarity * 100) / 100,
    confidence: similarity >= 0.8 && distanceM <= 75 ? "strong" : "weak" };
}

export function mapBestTimeForecast(raw: unknown, input: BestTimeInput): BestTimeForecast | null {
  const data = object(raw);
  if (data.status !== "OK") return null;
  const identity = matchBestTime(data.venue_info, input);
  if (!identity || !Array.isArray(data.analysis)) return null;
  const days: BestTimeDay[] = [];
  for (const entry of data.analysis) {
    const row = object(entry);
    const day = object(row.day_info).day_int;
    const hours = row.day_raw;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day >= DAYS || days.some((d) => d.day === day) ||
      !Array.isArray(hours) || hours.length !== 24 || !hours.every((h) => typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 100)) return null;
    days.push({ day, hours: hours as number[] });
  }
  return days.length === DAYS ? { kind: "forecast", identity, days: days.sort((a, b) => a.day - b.day) } : null;
}

export function mapBestTimeLive(raw: unknown, input: BestTimeInput): BestTimeLive | null {
  const data = object(raw);
  if (data.status !== "OK") return null;
  const identity = matchBestTime(data.venue_info, input);
  if (!identity) return null;
  const analysis = object(data.analysis);
  const available = analysis.venue_live_busyness_available === true;
  const busyness = number(analysis.venue_live_busyness, 0, 10000);
  if (available && busyness === null) return null;
  const forecast = number(analysis.venue_forecasted_busyness, 0, 100);
  return { kind: "live", identity, available, ...(available ? { busyness: busyness! } : {}),
    ...(analysis.venue_forecast_busyness_available === true && forecast !== null ? { forecastBusyness: forecast } : {}) };
}

export class BestTimeError extends Error {
  constructor(public readonly status: number) {
    super(status === 429 ? "BestTime rate limit reached. Try again later." : status === 503 ? "BestTime is not configured." : status === 504 ? "BestTime timed out. Try again later." : "BestTime request failed or returned no usable forecast.");
  }
}

type Env = Record<string, string | undefined>;
/** Preferred name for the private key used by paid forecast and live calls. */
export const BESTTIME_PRIVATE_KEY_ENV = "BESTTIME_PRIVATE_API_KEY";
/** Read-only key, reported as setup status only: this app never sends it to BestTime. */
export const BESTTIME_PUBLIC_KEY_ENV = "BESTTIME_PUBLIC_API_KEY";
/** Legacy name, read only when the preferred name is empty and only into the slot its prefix proves. */
export const BESTTIME_LEGACY_KEY_ENV = "BESTPLACES_API_KEY";

export type BestTimeKeyState = "ok" | "missing" | "wrong_type" | "invalid";
export type BestTimeKeyStatus = { privateKey: BestTimeKeyState; publicKey: BestTimeKeyState };
type KeyPrefix = "pri_" | "pub_";

function keyState(raw: string | undefined, prefix: KeyPrefix): BestTimeKeyState {
  const value = raw?.trim();
  if (!value) return "missing";
  if (value.startsWith(prefix === "pri_" ? "pub_" : "pri_")) return "wrong_type";
  return value.startsWith(prefix) && /^[A-Za-z0-9]{1,64}$/.test(value.slice(prefix.length)) ? "ok" : "invalid";
}

// A set preferred name always wins so its mistakes are reported, not masked by the legacy name.
// The legacy value may belong to another provider, so it is ignored unless its BestTime prefix validates.
function resolveKey(env: Env, name: string, prefix: KeyPrefix): { state: BestTimeKeyState; value?: string } {
  const preferred = env[name]?.trim();
  const state = keyState(preferred, prefix);
  if (state !== "missing") return state === "ok" ? { state, value: preferred } : { state };
  const legacy = env[BESTTIME_LEGACY_KEY_ENV]?.trim();
  return keyState(legacy, prefix) === "ok" ? { state: "ok", value: legacy } : { state: "missing" };
}

/** Key states only, never values. Safe for the public health endpoint. */
export function bestTimeKeyStatus(env: Env = process.env): BestTimeKeyStatus {
  return { privateKey: resolveKey(env, BESTTIME_PRIVATE_KEY_ENV, "pri_").state, publicKey: resolveKey(env, BESTTIME_PUBLIC_KEY_ENV, "pub_").state };
}

/** Paid forecast and live calls need a private key; a public key alone is read-only. */
export function bestTimeConfigured(env: Env = process.env): boolean {
  return resolveKey(env, BESTTIME_PRIVATE_KEY_ENV, "pri_").state === "ok";
}

/** Fixed HTTPS host, POST only, no redirects. Keep key out of browser, error strings and logs. */
export async function requestBestTime(action: "forecast" | "live", input: BestTimeInput): Promise<BestTimeForecast | BestTimeLive> {
  const key = resolveKey(process.env, BESTTIME_PRIVATE_KEY_ENV, "pri_").value;
  if (!key) throw new BestTimeError(503);
  const url = new URL(action === "forecast" ? BASE : `${BASE}/live`);
  const params = new URLSearchParams({ api_key_private: key, venue_name: input.name, venue_address: input.address });
  let response: Response;
  try {
    // BestTime documents POST parameters in the query string, not in the body.
    url.search = params.toString();
    response = await fetch(url, { method: "POST", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  } catch { throw new BestTimeError(504); }
  if (!response.ok) throw new BestTimeError(response.status === 429 ? 429 : 502);
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new BestTimeError(502); }
  const mapped = action === "forecast" ? mapBestTimeForecast(raw, input) : mapBestTimeLive(raw, input);
  if (!mapped) throw new BestTimeError(502);
  return mapped;
}
