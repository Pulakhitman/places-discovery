import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
  accessKeyMatches,
  hashAccessKey,
  isAccessKeyConfigured,
} from "@/lib/auth/access-key";

type UnlockBody = {
  key?: unknown;
};

/**
 * POST /api/auth/unlock
 * Body: { key: string }. Sets httpOnly cookie on success.
 * Never echoes the key. Returns 400 when gate is off.
 */
export async function POST(request: Request) {
  if (!isAccessKeyConfigured()) {
    return NextResponse.json(
      { error: "Access key gate is not enabled" },
      { status: 400 },
    );
  }

  let body: UnlockBody;
  try {
    body = (await request.json()) as UnlockBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  if (!(await accessKeyMatches(key))) {
    return NextResponse.json(
      { error: "Invalid access key" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const digest = await hashAccessKey(key);
  // Traefik terminates TLS; request.url is often http://inside the container.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure =
    process.env.NODE_ENV === "production" ||
    forwardedProto === "https" ||
    request.url.startsWith("https://");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ACCESS_COOKIE_NAME,
    digest,
    accessCookieOptions(secure),
  );
  return response;
}
