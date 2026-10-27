/** Human-readable distance for UI. */
export function formatDistance(m: number): string {
  if (m < 1000) {
    return `${m} m`;
  }
  return `${(m / 1000).toFixed(1)} km`;
}

/** Stable lat/lng label for UI and copy. */
export function formatLatLng(lat: number, lng: number, digits = 5): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

export function osmBrowseUrl(osmType: string, osmId: number): string {
  return `https://www.openstreetmap.org/${osmType}/${osmId}`;
}

/**
 * Make OSM website/url tags safe for `<a href>`.
 * Tags often omit the scheme (`example.com` / `www…`).
 */
export function normalizeHttpUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) {
    return undefined;
  }
  if (/^(https?:|mailto:|tel:)/i.test(value)) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  // Host-like: example.com, www…, subdomain.example.co.uk/path
  if (
    /^www\./i.test(value) ||
    /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?#].*)?$/i.test(value)
  ) {
    return `https://${value}`;
  }
  return undefined;
}

/** Prefer a clickable href; fall back to the raw tag for display-only. */
export function websiteHref(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  return normalizeHttpUrl(trimmed) ?? trimmed;
}
