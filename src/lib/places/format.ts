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
