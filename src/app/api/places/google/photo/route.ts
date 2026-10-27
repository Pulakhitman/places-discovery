import { NextResponse } from "next/server";
import {
  fetchGooglePlacePhoto,
  GooglePlacesError,
  isGooglePlacesConfigured,
} from "@/lib/providers/google-places";

/**
 * GET /api/places/google/photo?name=places/.../photos/...&maxHeightPx=400
 * Proxies Place Photos so the browser never sees the server API key.
 */
export async function GET(request: Request) {
  if (!isGooglePlacesConfigured()) {
    return NextResponse.json(
      { status: "unavailable", message: "GOOGLE_MAPS_API_KEY is not set." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() ?? "";
  const maxHeightPx = Number(searchParams.get("maxHeightPx") ?? 400);

  if (!name) {
    return NextResponse.json(
      { status: "error", message: "name is required." },
      { status: 400 },
    );
  }

  try {
    const photo = await fetchGooglePlacePhoto({
      photoName: name,
      maxHeightPx: Number.isFinite(maxHeightPx) ? maxHeightPx : 400,
    });
    return new NextResponse(photo.body, {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof GooglePlacesError) {
      const status =
        err.kind === "parse"
          ? 400
          : err.kind === "rate_limited"
            ? 429
            : err.kind === "timeout"
              ? 504
              : 502;
      return NextResponse.json(
        { status: "error", message: err.message },
        { status },
      );
    }
    return NextResponse.json(
      { status: "error", message: "Photo fetch failed." },
      { status: 502 },
    );
  }
}
