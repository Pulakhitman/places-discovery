import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  cookieMatchesAccessKey,
  isAccessKeyConfigured,
} from "@/lib/auth/access-key";

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/unlock",
  "/api/auth/unlock",
  "/api/auth/logout",
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Optional ACCESS_KEY gate.
 * When ACCESS_KEY is set, all UI and API routes (except health + unlock/logout)
 * require a valid httpOnly access cookie. When unset, no gate.
 */
export async function middleware(request: NextRequest) {
  if (!isAccessKeyConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (await cookieMatchesAccessKey(cookieValue)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const unlockUrl = request.nextUrl.clone();
  unlockUrl.pathname = "/unlock";
  unlockUrl.search = "";
  if (pathname !== "/" || request.nextUrl.search) {
    const next = `${pathname}${request.nextUrl.search}`;
    unlockUrl.searchParams.set("next", next);
  }
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: [
    /*
     * Protect everything except Next internals and favicon.
     * Health / unlock stay public inside the middleware body.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
