import {
  parseOverpassElements,
  type OverpassElement,
} from "@/lib/places/parse-overpass";
import type { OsmPlace } from "@/lib/places/types";
import type { NominatimBBox, PlaceCategoryId } from "@/lib/search/categories";
import { buildOverpassQuery } from "@/lib/search/overpass-queries";

export type OverpassErrorKind = "timeout" | "rate_limited" | "http" | "parse";

export class OverpassError extends Error {
  constructor(
    message: string,
    public readonly kind: OverpassErrorKind,
    public readonly status?: number,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "OverpassError";
  }
}

function baseUrl(): string {
  return (
    process.env.OVERPASS_URL?.trim() ||
    "https://overpass-api.de/api/interpreter"
  );
}

function timeoutMs(): number {
  const raw = process.env.OVERPASS_TIMEOUT_MS;
  const n = raw ? Number(raw) : 60_000;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

function userAgent(): string {
  return (
    process.env.OVERPASS_USER_AGENT ||
    process.env.NOMINATIM_USER_AGENT ||
    "PlacesDiscovery/0.1 (https://github.com/Pulakhitman/places-discovery)"
  );
}

export type OverpassSearchParams = {
  category: PlaceCategoryId;
  customKeyword?: string;
  signal?: AbortSignal;
} & (
  | { mode?: "radius"; lat: number; lng: number; radiusM: number; bbox?: never }
  | { mode: "area"; bbox: NominatimBBox; lat: number; lng: number; radiusM?: never }
);

type OverpassJson = {
  elements?: OverpassElement[];
  remark?: string;
};

/**
 * Query Overpass for nearby places. Configurable via OVERPASS_URL.
 */
export async function searchOverpass(
  params: OverpassSearchParams,
): Promise<OsmPlace[]> {
  const query =
    params.mode === "area"
      ? buildOverpassQuery({
          mode: "area",
          bbox: params.bbox,
          category: params.category,
          customKeyword: params.customKeyword,
        })
      : buildOverpassQuery({
          lat: params.lat,
          lng: params.lng,
          radiusM: params.radiusM,
          category: params.category,
          customKeyword: params.customKeyword,
        });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(baseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": userAgent(),
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 429 || res.status === 504) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSec = retryAfter ? Number(retryAfter) : undefined;
      throw new OverpassError(
        res.status === 429
          ? "Overpass rate limit reached. Please wait and try again."
          : "Overpass gateway timeout. Please try again.",
        res.status === 429 ? "rate_limited" : "timeout",
        res.status,
        Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
      );
    }

    if (!res.ok) {
      throw new OverpassError(
        `Overpass request failed (${res.status}).`,
        "http",
        res.status,
      );
    }

    const data = (await res.json()) as OverpassJson;
    if (!data || !Array.isArray(data.elements)) {
      throw new OverpassError("Unexpected Overpass response.", "parse");
    }

    return parseOverpassElements(data.elements, {
      center: { lat: params.lat, lng: params.lng },
      categoryId: params.category,
    });
  } catch (err) {
    if (err instanceof OverpassError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new OverpassError("Overpass request timed out.", "timeout");
    }
    throw new OverpassError(
      err instanceof Error ? err.message : "Overpass request failed.",
      "http",
    );
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", onAbort);
  }
}
