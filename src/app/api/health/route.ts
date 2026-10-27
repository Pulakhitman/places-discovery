import { connection, NextResponse } from "next/server";
import { isBasicAuthConfigured } from "@/lib/auth/basic-auth";
import { isGooglePlacesConfigured } from "@/lib/providers/google-places";

/**
 * GET /api/health
 * Public even when Basic Auth is enabled (load balancers / Docker).
 * Never returns secret values.
 */
export async function GET() {
  await connection();
  return NextResponse.json({
    ok: true,
    service: "places-discovery",
    ts: new Date().toISOString(),
    googlePlacesConfigured: isGooglePlacesConfigured(),
    basicAuthConfigured: isBasicAuthConfigured(),
  });
}
