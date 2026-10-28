import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/access-key";

/**
 * POST /api/auth/logout
 * Clears the access cookie. Always allowed (even when locked).
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
