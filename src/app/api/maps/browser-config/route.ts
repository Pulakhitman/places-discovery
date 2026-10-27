import { NextResponse } from "next/server";

/**
 * GET /api/maps/browser-config
 * Browser Maps JS key is intentionally public (restrict by HTTP referrer in GCP).
 * Returns the key only when GOOGLE_MAPS_BROWSER_KEY is set.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() || "";
  const enabled = Boolean(apiKey);
  return NextResponse.json({
    enabled,
    apiKey: enabled ? apiKey : null,
    message: enabled
      ? "Google Maps JavaScript basemap available in the same map container."
      : "Set GOOGLE_MAPS_BROWSER_KEY (Maps JavaScript API) to enable the Google basemap toggle.",
  });
}
