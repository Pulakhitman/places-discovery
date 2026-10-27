import { NextResponse } from "next/server";
import { getGoogleUsageSnapshot } from "@/lib/places/google-usage";
import { isGooglePlacesConfigured } from "@/lib/providers/google-places";

/**
 * GET /api/places/google/usage
 * Process-local Places API call counts + soft budget estimate (not Cloud billing).
 */
export async function GET() {
  const snapshot = getGoogleUsageSnapshot();
  return NextResponse.json({
    configured: isGooglePlacesConfigured(),
    ...snapshot,
    disclaimer:
      "Estimates only for this app process. Official spend is in Google Cloud Billing. No scrapers.",
  });
}
