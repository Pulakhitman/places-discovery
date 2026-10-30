import { connection, NextResponse } from "next/server";
import { isAccessKeyConfigured } from "@/lib/auth/access-key";
import { isGooglePlacesConfigured } from "@/lib/providers/google-places";
import { overtureConfigured } from "@/lib/providers/overture";
import { foursquareConfigured } from "@/lib/providers/foursquare";
import { bestTimeConfigured, bestTimeKeyStatus } from "@/lib/providers/besttime";

/**
 * GET /api/health
 * Public even when the access-key gate is enabled (load balancers / Docker).
 * Never returns secret values.
 */
export async function GET() {
  await connection();
  return NextResponse.json({
    ok: true,
    service: "places-discovery",
    ts: new Date().toISOString(),
    googlePlacesConfigured: isGooglePlacesConfigured(),
    overtureConfigured: overtureConfigured(),
    foursquareConfigured: foursquareConfigured(),
    bestTimeConfigured: bestTimeConfigured(),
    bestTimeKeyStatus: bestTimeKeyStatus(),
    accessKeyConfigured: isAccessKeyConfigured(),
  });
}
