import { connection, NextResponse } from "next/server";
import { isAccessKeyConfigured } from "@/lib/auth/access-key";
import { isGooglePlacesConfigured } from "@/lib/providers/google-places";

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
    accessKeyConfigured: isAccessKeyConfigured(),
  });
}
