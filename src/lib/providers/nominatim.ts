import type { GeocodeResult } from "@/lib/location/types";

export type NominatimErrorKind = "timeout" | "rate_limited" | "http" | "parse";

export class NominatimError extends Error {
  constructor(
    message: string,
    public readonly kind: NominatimErrorKind,
    public readonly status?: number,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "NominatimError";
  }
}

type NominatimRaw = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
  type?: string;
  importance?: number;
};

function baseUrl(): string {
  return (
    process.env.NOMINATIM_URL?.replace(/\/$/, "") ||
    "https://nominatim.openstreetmap.org"
  );
}

function timeoutMs(): number {
  const raw = process.env.NOMINATIM_TIMEOUT_MS;
  const n = raw ? Number(raw) : 10_000;
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

function userAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT ||
    "PlacesDiscovery/0.1 (https://github.com/Pulakhitman/places-discovery)"
  );
}

function mapResult(raw: NominatimRaw): GeocodeResult {
  const bbox = raw.boundingbox
    ? ([
        Number(raw.boundingbox[0]),
        Number(raw.boundingbox[1]),
        Number(raw.boundingbox[2]),
        Number(raw.boundingbox[3]),
      ] as [number, number, number, number])
    : undefined;

  return {
    id: String(raw.place_id),
    displayName: raw.display_name,
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    boundingBox: bbox,
    type: raw.type,
    importance: raw.importance,
  };
}

export type NominatimSearchParams = {
  query: string;
  countryCode?: string;
  /** Restrict to admin feature classes when searching regions/cities. */
  featureType?: "country" | "state" | "city";
  limit?: number;
  signal?: AbortSignal;
};

/**
 * Search Nominatim. Never auto-selects; returns the full match list.
 */
export async function searchNominatim(
  params: NominatimSearchParams,
): Promise<GeocodeResult[]> {
  const q = params.query.trim();
  if (!q) {
    return [];
  }

  const url = new URL(`${baseUrl()}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(params.limit ?? 8));
  if (params.countryCode) {
    url.searchParams.set("countrycodes", params.countryCode.toLowerCase());
  }
  if (params.featureType) {
    url.searchParams.set("featureType", params.featureType);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSec = retryAfter ? Number(retryAfter) : undefined;
      throw new NominatimError(
        "Nominatim rate limit reached. Please wait and try again.",
        "rate_limited",
        429,
        Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
      );
    }

    if (!res.ok) {
      throw new NominatimError(
        `Nominatim request failed (${res.status}).`,
        "http",
        res.status,
      );
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new NominatimError(
        "Unexpected Nominatim response.",
        "parse",
        res.status,
      );
    }

    return (data as NominatimRaw[]).map(mapResult);
  } catch (err) {
    if (err instanceof NominatimError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new NominatimError(
        "Nominatim request timed out.",
        "timeout",
      );
    }
    throw new NominatimError(
      err instanceof Error ? err.message : "Nominatim request failed.",
      "http",
    );
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", onAbort);
  }
}
