import { NextResponse } from "next/server";
import type { GoogleLookupResponse } from "@/lib/places/google-types";
import {
  GooglePlacesError,
  isGooglePlacesConfigured,
  lookupGoogleForPlace,
} from "@/lib/providers/google-places";

/**
 * POST /api/places/google/lookup
 * Body: { name, lat, lng, radiusM? }
 * Match a place name near coordinates via Text Search, then Place Details.
 */
export async function POST(request: Request) {
  if (!isGooglePlacesConfigured()) {
    const body: GoogleLookupResponse = {
      status: "unavailable",
      message:
        "GOOGLE_MAPS_API_KEY is not set. Add it to .env to load Google details.",
    };
    return NextResponse.json(body, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    const body: GoogleLookupResponse = {
      status: "error",
      message: "Invalid JSON body.",
      retryable: false,
    };
    return NextResponse.json(body, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  const radiusM =
    payload.radiusM === undefined ? 400 : Number(payload.radiusM);

  if (!name) {
    const body: GoogleLookupResponse = {
      status: "error",
      message: "name is required.",
      retryable: false,
    };
    return NextResponse.json(body, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const body: GoogleLookupResponse = {
      status: "error",
      message: "lat and lng are required numbers.",
      retryable: false,
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const details = await lookupGoogleForPlace({
      name,
      lat,
      lng,
      radiusM: Number.isFinite(radiusM) ? radiusM : 400,
    });

    if (!details) {
      const body: GoogleLookupResponse = {
        status: "empty",
        message: "No matching Google Place found nearby.",
      };
      return NextResponse.json(body);
    }

    const body: GoogleLookupResponse = { status: "ok", details };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof GooglePlacesError) {
      if (err.kind === "not_configured") {
        const body: GoogleLookupResponse = {
          status: "unavailable",
          message: err.message,
        };
        return NextResponse.json(body, { status: 503 });
      }
      const status =
        err.kind === "rate_limited" ? 429 : err.kind === "timeout" ? 504 : 502;
      const body: GoogleLookupResponse = {
        status: "error",
        message: err.message,
        retryable: err.kind !== "parse",
      };
      return NextResponse.json(body, { status });
    }

    const body: GoogleLookupResponse = {
      status: "error",
      message: "Google lookup failed.",
      retryable: true,
    };
    return NextResponse.json(body, { status: 502 });
  }
}
