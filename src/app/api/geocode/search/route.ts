import { NextResponse } from "next/server";
import {
  NominatimError,
  searchNominatim,
} from "@/lib/providers/nominatim";

/**
 * GET /api/geocode/search?q=&country=&level=
 * Returns Nominatim matches. Never auto-selects — client must pick explicitly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const country = searchParams.get("country")?.trim() || undefined;
  const level = searchParams.get("level")?.trim() || undefined;

  if (!q) {
    return NextResponse.json({ results: [], status: "empty", query: q });
  }

  const featureType =
    level === "region"
      ? ("state" as const)
      : level === "city"
        ? ("city" as const)
        : undefined;

  try {
    const results = await searchNominatim({
      query: q,
      countryCode: country,
      featureType,
      limit: 8,
      signal: request.signal,
    });

    if (results.length === 0) {
      return NextResponse.json({ results: [], status: "empty", query: q });
    }

    return NextResponse.json({ results, status: "ok", query: q });
  } catch (err) {
    if (err instanceof NominatimError) {
      if (err.kind === "rate_limited") {
        return NextResponse.json(
          {
            results: [],
            status: "rate_limited",
            message: err.message,
            retryAfterSec: err.retryAfterSec,
          },
          {
            status: 429,
            headers: err.retryAfterSec
              ? { "Retry-After": String(err.retryAfterSec) }
              : undefined,
          },
        );
      }

      const status = err.kind === "timeout" ? 504 : 502;
      return NextResponse.json(
        {
          results: [],
          status: "error",
          message: err.message,
          retryable: true,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        results: [],
        status: "error",
        message: "Geocoding failed.",
        retryable: true,
      },
      { status: 502 },
    );
  }
}
