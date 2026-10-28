import { connection, NextResponse } from "next/server";
import type { GoogleStatusResponse } from "@/lib/places/google-types";
import { isGooglePlacesConfigured } from "@/lib/providers/google-places";

/**
 * GET /api/places/google/status
 * Whether the server Google Places key is configured (never returns the key).
 * Must await connection() so cacheComponents does not prerender with a
 * build-time empty GOOGLE_MAPS_API_KEY (Docker build has no runtime .env).
 */
export async function GET() {
  await connection();
  const configured = isGooglePlacesConfigured();
  const body: GoogleStatusResponse = {
    configured,
    message: configured
      ? "Google Places is configured. Selecting a place can load hours, ratings, and reviews."
      : "Set GOOGLE_MAPS_API_KEY to enable Google hours, ratings, and reviews (official API only).",
  };
  return NextResponse.json(body);
}
