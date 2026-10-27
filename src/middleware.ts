import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  credentialsMatch,
  isBasicAuthConfigured,
  parseBasicAuthorizationHeader,
  unauthorizedBasicResponse,
} from "@/lib/auth/basic-auth";

/**
 * Optional Basic Auth when AUTH_USER + AUTH_PASSWORD are set.
 * Always allows /api/health for load balancers and Docker healthchecks.
 */
export function middleware(request: NextRequest) {
  if (!isBasicAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const provided = parseBasicAuthorizationHeader(
    request.headers.get("authorization"),
  );
  if (!credentialsMatch(provided)) {
    return unauthorizedBasicResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect everything except Next internals and favicon.
     * Health is allowed inside the middleware body.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
