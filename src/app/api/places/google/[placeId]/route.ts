import { NextResponse } from "next/server";
import type { GoogleLookupResponse } from "@/lib/places/google-types";
import {
  getGooglePlaceDetails,
  GooglePlacesError,
  isGooglePlacesConfigured,
} from "@/lib/providers/google-places";

type Ctx = { params: Promise<{ placeId: string }> };

/**
 * GET /api/places/google/[placeId]
 * Place Details (New) for a Google place id.
 */
export async function GET(_request: Request, context: Ctx) {
  if (!isGooglePlacesConfigured()) {
    const body: GoogleLookupResponse = {
      status: "unavailable",
      message:
        "GOOGLE_MAPS_API_KEY is not set. Add it to .env to load Google details.",
    };
    return NextResponse.json(body, { status: 503 });
  }

  const { placeId: rawId } = await context.params;
  const placeId = decodeURIComponent(rawId ?? "").trim();
  if (!placeId) {
    const body: GoogleLookupResponse = {
      status: "error",
      message: "placeId is required.",
      retryable: false,
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const details = await getGooglePlaceDetails(placeId);
    if (!details) {
      const body: GoogleLookupResponse = {
        status: "empty",
        message: "Place not found.",
      };
      return NextResponse.json(body, { status: 404 });
    }
    const body: GoogleLookupResponse = { status: "ok", details };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof GooglePlacesError) {
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
      message: "Place details failed.",
      retryable: true,
    };
    return NextResponse.json(body, { status: 502 });
  }
}
