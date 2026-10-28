/**
 * Optional shared ACCESS_KEY gate.
 * Enabled only when ACCESS_KEY is set. Verified server-side only;
 * the browser stores an httpOnly cookie of a key hash (never the raw key).
 */

export const ACCESS_COOKIE_NAME = "places_access";

/** 30 days */
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AuthEnv = Record<string, string | undefined>;

export function isAccessKeyConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(env.ACCESS_KEY?.length);
}

export function getAccessKey(env: AuthEnv = process.env): string {
  return env.ACCESS_KEY ?? "";
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Timing-safe equality for equal-length strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** SHA-256 hex digest used as the cookie payload (not the raw key). */
export async function hashAccessKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(`places-discovery:v1:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

export async function accessKeyMatches(
  provided: string,
  env: AuthEnv = process.env,
): Promise<boolean> {
  const expected = getAccessKey(env);
  if (!provided.length || !expected.length) {
    return false;
  }
  if (provided.length !== expected.length) {
    // Still hash both sides to keep timing closer when lengths differ.
    const [a, b] = await Promise.all([
      hashAccessKey(provided),
      hashAccessKey(expected),
    ]);
    void timingSafeEqual(a, b);
    return false;
  }
  return timingSafeEqual(provided, expected);
}

export async function cookieMatchesAccessKey(
  cookieValue: string | undefined | null,
  env: AuthEnv = process.env,
): Promise<boolean> {
  if (!cookieValue || !isAccessKeyConfigured(env)) {
    return false;
  }
  const expected = await hashAccessKey(getAccessKey(env));
  return timingSafeEqual(cookieValue, expected);
}

export function accessCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  };
}
