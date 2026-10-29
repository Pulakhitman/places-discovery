import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, cookieMatchesAccessKey, isAccessKeyConfigured } from "@/lib/auth/access-key";
import type { BestTimeResponse } from "@/lib/places/besttime-types";
import { BestTimeError, bestTimeConfigured, requestBestTime, validateBestTimeInput } from "@/lib/providers/besttime";

function json(body: BestTimeResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}

/** A call is made only in response to a POST for a single OSM venue. */
export async function POST(request: Request) {
  if (isAccessKeyConfigured() && !(await cookieMatchesAccessKey((await cookies()).get(ACCESS_COOKIE_NAME)?.value))) return json({ status: "error", message: "Unlock the app first." }, 401);
  if (!bestTimeConfigured()) return json({ status: "unavailable", message: "BestTime is not configured." }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return json({ status: "error", message: "Request too large." }, 413);
  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ status: "error", message: "Invalid JSON." }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ status: "error", message: "Invalid input." }, 400);
  const body = payload as Record<string, unknown>;
  const input = validateBestTimeInput(body);
  if (!input || (body.action !== "forecast" && body.action !== "live")) return json({ status: "error", message: "An OSM venue with a precise address and valid coordinates is required." }, 400);
  try {
    const result = await requestBestTime(body.action, input);
    return json({ status: "ok", result });
  } catch (error) {
    const status = error instanceof BestTimeError ? error.status : 502;
    return json({ status: "error", message: error instanceof BestTimeError ? error.message : "BestTime request failed." }, [429, 503, 504].includes(status) ? status : 502);
  }
}
