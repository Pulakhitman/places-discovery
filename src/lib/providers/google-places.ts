import {
  getCachedGoogleDetails,
  setCachedGoogleDetails,
} from "@/lib/places/google-details-cache";
import { scoreGoogleMatch, type GoogleMatchInfo } from "@/lib/places/google-match";
import type {
  GooglePlaceDetails,
  GooglePlacePhoto,
  GooglePlaceReview,
} from "@/lib/places/google-types";
import type { PlaceCategoryId } from "@/lib/search/categories";
import { googleIncludedTypes } from "@/lib/search/google-types-map";

const PLACES_BASE = "https://places.googleapis.com/v1";
const ATTRIBUTION = "Google Maps";

export type GooglePlacesErrorKind =
  | "not_configured"
  | "http"
  | "timeout"
  | "parse"
  | "rate_limited";

export class GooglePlacesError extends Error {
  constructor(
    message: string,
    public readonly kind: GooglePlacesErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GooglePlacesError";
  }
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new GooglePlacesError(
      "GOOGLE_MAPS_API_KEY is not set.",
      "not_configured",
    );
  }
  return key;
}

function timeoutMs(): number {
  const raw = process.env.GOOGLE_PLACES_TIMEOUT_MS;
  const n = raw ? Number(raw) : 15_000;
  return Number.isFinite(n) && n > 0 ? n : 15_000;
}

type GoogleLatLng = { latitude: number; longitude: number };

type GooglePlaceRaw = {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: GoogleLatLng;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: Array<{
    rating?: number;
    text?: { text?: string; languageCode?: string };
    originalText?: { text?: string; languageCode?: string };
    authorAttribution?: {
      displayName?: string;
      uri?: string;
      photoUri?: string;
    };
    relativePublishTimeDescription?: string;
    publishTime?: string;
    googleMapsUri?: string;
    flagContentUri?: string;
    visitDateMonth?: number;
    visitDateYear?: number;
  }>;
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
  }>;
};

const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
].join(",");

/** Slim match mask — avoids Enterprise rating SKU on Text Search for OSM↔Google. */
const MATCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "primaryType",
  "regularOpeningHours",
  "reviews",
  "photos",
].join(",");

const TEXT_FIELD_MASK = NEARBY_FIELD_MASK;

async function placesFetch(
  path: string,
  init: RequestInit & { fieldMask: string },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(`${PLACES_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": init.fieldMask,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GooglePlacesError("Google Places request timed out.", "timeout");
    }
    throw new GooglePlacesError(
      err instanceof Error ? err.message : "Google Places request failed.",
      "http",
    );
  } finally {
    clearTimeout(timer);
  }
}

function throwForResponse(res: Response): never {
  if (res.status === 429) {
    throw new GooglePlacesError(
      "Google Places rate limit reached. Please try again later.",
      "rate_limited",
      429,
    );
  }
  throw new GooglePlacesError(
    `Google Places request failed (${res.status}).`,
    "http",
    res.status,
  );
}

function photoMediaUrl(photoName: string): string {
  const params = new URLSearchParams({
    name: photoName,
    maxHeightPx: "400",
  });
  return `/api/places/google/photo?${params.toString()}`;
}

export function mapGooglePlaceDetails(
  raw: GooglePlaceRaw,
): GooglePlaceDetails | null {
  const placeId = raw.id?.trim();
  const name = raw.displayName?.text?.trim();
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (!placeId || !name || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const reviews: GooglePlaceReview[] = (raw.reviews ?? [])
    .slice(0, 5)
    .map((r) => ({
      rating: r.rating,
      text: r.text?.text?.trim() || undefined,
      originalText: r.originalText?.text?.trim() || undefined,
      authorName: r.authorAttribution?.displayName?.trim() || undefined,
      authorUri: r.authorAttribution?.uri?.trim() || undefined,
      authorPhotoUri: r.authorAttribution?.photoUri?.trim() || undefined,
      relativeTime: r.relativePublishTimeDescription?.trim() || undefined,
      publishTime: r.publishTime?.trim() || undefined,
      googleMapsUri: r.googleMapsUri?.trim() || undefined,
      flagContentUri: r.flagContentUri?.trim() || undefined,
      visitDateMonth: r.visitDateMonth,
      visitDateYear: r.visitDateYear,
    }));

  const photos: GooglePlacePhoto[] = (raw.photos ?? [])
    .filter((p): p is { name: string; widthPx?: number; heightPx?: number } =>
      Boolean(p.name?.trim()),
    )
    .slice(0, 6)
    .map((p) => ({
      name: p.name!,
      widthPx: p.widthPx,
      heightPx: p.heightPx,
      mediaUrl: photoMediaUrl(p.name!),
    }));

  return {
    placeId,
    name,
    lat,
    lng,
    address: raw.formattedAddress?.trim() || undefined,
    hoursWeekday: raw.regularOpeningHours?.weekdayDescriptions?.filter(Boolean),
    phone:
      raw.nationalPhoneNumber?.trim() ||
      raw.internationalPhoneNumber?.trim() ||
      undefined,
    website: raw.websiteUri?.trim() || undefined,
    googleMapsUri: raw.googleMapsUri?.trim() || undefined,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    reviews,
    photos,
    primaryType: raw.primaryType,
    attribution: ATTRIBUTION,
  };
}

/**
 * Nearby Search (New) for a category around a center.
 */
export async function searchGoogleNearby(params: {
  lat: number;
  lng: number;
  radiusM: number;
  category: PlaceCategoryId;
  customKeyword?: string;
  maxResultCount?: number;
}): Promise<GooglePlaceDetails[]> {
  if (params.category === "custom") {
    return searchGoogleText({
      lat: params.lat,
      lng: params.lng,
      radiusM: params.radiusM,
      textQuery: params.customKeyword?.trim() || "place",
      maxResultCount: params.maxResultCount,
    });
  }

  const includedTypes = googleIncludedTypes(params.category);
  if (!includedTypes) {
    return [];
  }

  const res = await placesFetch("/places:searchNearby", {
    method: "POST",
    fieldMask: NEARBY_FIELD_MASK,
    body: JSON.stringify({
      includedTypes,
      maxResultCount: params.maxResultCount ?? 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: Math.min(Math.max(params.radiusM, 1), 50_000),
        },
      },
    }),
  });

  if (!res.ok) {
    throwForResponse(res);
  }

  const data = (await res.json()) as { places?: GooglePlaceRaw[] };
  if (!data || !Array.isArray(data.places)) {
    return [];
  }

  return data.places
    .map((p) => mapGooglePlaceDetails(p))
    .filter((p): p is GooglePlaceDetails => p !== null);
}

/**
 * Text Search (New) — used for custom keywords and OSM→Google matching.
 */
export async function searchGoogleText(params: {
  lat: number;
  lng: number;
  radiusM: number;
  textQuery: string;
  maxResultCount?: number;
  /** Use slim id/name/location mask for OSM→Google matching (cheaper). */
  matchOnly?: boolean;
}): Promise<GooglePlaceDetails[]> {
  const textQuery = params.textQuery.trim();
  if (!textQuery) {
    return [];
  }

  const res = await placesFetch("/places:searchText", {
    method: "POST",
    fieldMask: params.matchOnly ? MATCH_FIELD_MASK : TEXT_FIELD_MASK,
    body: JSON.stringify({
      textQuery,
      maxResultCount: params.maxResultCount ?? 5,
      locationBias: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: Math.min(Math.max(params.radiusM, 50), 50_000),
        },
      },
    }),
  });

  if (!res.ok) {
    throwForResponse(res);
  }

  const data = (await res.json()) as { places?: GooglePlaceRaw[] };
  if (!data || !Array.isArray(data.places)) {
    return [];
  }

  return data.places
    .map((p) => mapGooglePlaceDetails(p))
    .filter((p): p is GooglePlaceDetails => p !== null);
}

/**
 * Place Details (New) for a place id (with or without `places/` prefix).
 */
export async function getGooglePlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails | null> {
  const id = placeId.replace(/^places\//, "").trim();
  if (!id) {
    return null;
  }

  const cached = getCachedGoogleDetails(id);
  if (cached) {
    return cached;
  }

  const res = await placesFetch(
    `/places/${encodeURIComponent(id)}?languageCode=en`,
    {
      method: "GET",
      fieldMask: DETAILS_FIELD_MASK,
    },
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throwForResponse(res);
  }

  const raw = (await res.json()) as GooglePlaceRaw;
  const details = mapGooglePlaceDetails(raw);
  if (details) {
    setCachedGoogleDetails(details);
  }
  return details;
}

export type GoogleLookupResult = {
  details: GooglePlaceDetails;
  match: GoogleMatchInfo;
};

/**
 * Match an OSM-ish name near coordinates to a Google place, then load details.
 */
export async function lookupGoogleForPlace(params: {
  name: string;
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<GoogleLookupResult | null> {
  const name = params.name.trim();
  if (!name || name.toLowerCase().startsWith("unnamed")) {
    return null;
  }

  const matches = await searchGoogleText({
    lat: params.lat,
    lng: params.lng,
    radiusM: params.radiusM ?? 400,
    textQuery: name,
    maxResultCount: 3,
    matchOnly: true,
  });

  const best = matches[0];
  if (!best) {
    return null;
  }

  const match = scoreGoogleMatch({
    queriedName: name,
    googleName: best.name,
    queryLat: params.lat,
    queryLng: params.lng,
    googleLat: best.lat,
    googleLng: best.lng,
  });

  // Text summary omits reviews/hours — fetch full details (cached by placeId).
  const details = (await getGooglePlaceDetails(best.placeId)) ?? best;
  return { details, match };
}

/**
 * Stream a place photo from Google (server-side; keeps API key off the client).
 */
export async function fetchGooglePlacePhoto(params: {
  photoName: string;
  maxHeightPx?: number;
}): Promise<{ body: ArrayBuffer; contentType: string }> {
  const name = params.photoName.trim();
  if (!name.startsWith("places/") || !name.includes("/photos/")) {
    throw new GooglePlacesError("Invalid photo name.", "parse", 400);
  }

  const maxHeightPx = params.maxHeightPx ?? 400;
  const url = `${PLACES_BASE}/${name}/media?maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey() },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) {
      throwForResponse(res);
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    // skipHttpRedirect=true returns JSON with photoUri — follow that.
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as { photoUri?: string };
      if (!json.photoUri) {
        throw new GooglePlacesError("Photo URI missing.", "parse");
      }
      const img = await fetch(json.photoUri, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!img.ok) {
        throw new GooglePlacesError(
          `Photo download failed (${img.status}).`,
          "http",
          img.status,
        );
      }
      return {
        body: await img.arrayBuffer(),
        contentType: img.headers.get("content-type") || "image/jpeg",
      };
    }
    return { body: await res.arrayBuffer(), contentType };
  } catch (err) {
    if (err instanceof GooglePlacesError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new GooglePlacesError("Google photo request timed out.", "timeout");
    }
    throw new GooglePlacesError(
      err instanceof Error ? err.message : "Google photo request failed.",
      "http",
    );
  } finally {
    clearTimeout(timer);
  }
}
