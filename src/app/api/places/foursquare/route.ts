import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, cookieMatchesAccessKey, isAccessKeyConfigured } from "@/lib/auth/access-key";
import type { FoursquareResponse } from "@/lib/places/foursquare-types";
import { FoursquareError, foursquareConfigured, getFoursquarePremium, searchFoursquare, validateFoursquareInput, validFoursquareId } from "@/lib/providers/foursquare";

function json(body: FoursquareResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/** Both actions are POST-only; Premium is not fetched during Pro search. */
export async function POST(request: Request) {
  if (isAccessKeyConfigured() && !(await cookieMatchesAccessKey((await cookies()).get(ACCESS_COOKIE_NAME)?.value))) return json({ status: "error", message: "Unlock the app first." }, 401);
  if (!foursquareConfigured()) return json({ status: "unavailable", message: "Foursquare service key is not configured." }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return json({ status: "error", message: "Request too large." }, 413);
  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ status: "error", message: "Invalid JSON." }, 400); }
  if (!payload || typeof payload !== "object") return json({ status: "error", message: "Invalid input." }, 400);
  const body = payload as Record<string, unknown>;
  const input = validateFoursquareInput(body);
  if (!input || (body.action !== "search" && body.action !== "premium")) return json({ status: "error", message: "Invalid name, coordinates, or action." }, 400);
  if (body.action === "premium" && !validFoursquareId(body.id)) return json({ status: "error", message: "Invalid place ID." }, 400);
  try {
    // Re-match on the server for Premium: never trust a supplied ID, coordinates or confidence alone.
    const match = await searchFoursquare(input);
    if (!match) return json({ status: "empty", message: "No sufficiently close Foursquare match found." });
    if (body.action === "search") return json({ status: "ok", match, tier: "pro" });
    if (body.id !== match.place.id) return json({ status: "error", message: "Match changed. Search again before loading details." }, 409);
    // A weak match requires an explicit confirmation action in the UI.
    if (match.confidence === "weak" && body.confirmWeak !== true) return json({ status: "error", message: "Confirm this weak match before loading details." }, 409);
    const place = await getFoursquarePremium(match);
    return json({ status: "ok", tier: "premium", match: { ...match, place } });
  } catch (error) {
    const status = error instanceof FoursquareError ? error.status : 502;
    return json({ status: "error", message: error instanceof FoursquareError ? error.message : "Foursquare request failed." }, [400, 429, 503, 504].includes(status) ? status : 502);
  }
}
