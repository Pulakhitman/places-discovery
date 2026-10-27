import {
  isSearchMode,
  PLACE_CATEGORIES,
  SEARCH_RADII_KM,
  type PlaceCategoryId,
  type SearchMode,
  type SearchRadiusKm,
} from "@/lib/search/categories";

export type ShareSearchParams = {
  lat?: number;
  lng?: number;
  radiusKm?: SearchRadiusKm;
  category?: PlaceCategoryId;
  mode?: SearchMode;
  q?: string;
};

function isCategory(value: string): value is PlaceCategoryId {
  return PLACE_CATEGORIES.some((c) => c.id === value);
}

function isRadius(value: number): value is SearchRadiusKm {
  return (SEARCH_RADII_KM as readonly number[]).includes(value);
}

function parseCoord(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") {
    return undefined;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n;
}

/** Read shareable search state from a query string / URLSearchParams. */
export function parseShareSearchParams(
  source: URLSearchParams | string,
): ShareSearchParams {
  const params =
    typeof source === "string" ? new URLSearchParams(source) : source;
  const lat = parseCoord(params.get("lat"));
  const lng = parseCoord(params.get("lng"));
  const radiusRaw = params.get("radius") ?? params.get("radiusKm");
  const radiusNum = radiusRaw != null ? Number(radiusRaw) : NaN;
  const categoryRaw = params.get("category")?.trim() ?? "";
  const modeRaw = params.get("mode")?.trim() ?? "";
  const q = params.get("q")?.trim() || undefined;

  const out: ShareSearchParams = {};
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    out.lat = lat;
    out.lng = lng;
  }
  if (Number.isFinite(radiusNum) && isRadius(radiusNum)) {
    out.radiusKm = radiusNum;
  }
  if (categoryRaw && isCategory(categoryRaw)) {
    out.category = categoryRaw;
  }
  if (modeRaw && isSearchMode(modeRaw)) {
    out.mode = modeRaw;
  }
  if (q) {
    out.q = q.slice(0, 80);
  }
  return out;
}

/** Build query string (no leading ?) for the current search view. */
export function buildShareSearchParams(state: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radiusKm: SearchRadiusKm;
  category: PlaceCategoryId;
  mode: SearchMode;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (
    typeof state.lat === "number" &&
    typeof state.lng === "number" &&
    Number.isFinite(state.lat) &&
    Number.isFinite(state.lng)
  ) {
    params.set("lat", state.lat.toFixed(5));
    params.set("lng", state.lng.toFixed(5));
  }
  params.set("radius", String(state.radiusKm));
  params.set("category", state.category);
  params.set("mode", state.mode);
  const q = state.q?.trim();
  if (state.category === "custom" && q) {
    params.set("q", q.slice(0, 80));
  }
  return params.toString();
}

export function applyShareParamsToUrl(
  state: Parameters<typeof buildShareSearchParams>[0],
  historyMode: "replace" | "push" = "replace",
): void {
  if (typeof window === "undefined") {
    return;
  }
  const qs = buildShareSearchParams(state);
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) {
    return;
  }
  if (historyMode === "push") {
    window.history.pushState(null, "", next);
  } else {
    window.history.replaceState(null, "", next);
  }
}
