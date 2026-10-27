/**
 * Optional HTTP Basic Auth helpers.
 * Enabled only when both AUTH_USER and AUTH_PASSWORD are set.
 */

type AuthEnv = Record<string, string | undefined>;

export function isBasicAuthConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(env.AUTH_USER?.trim() && env.AUTH_PASSWORD?.length);
}

export function parseBasicAuthorizationHeader(
  header: string | null,
): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }
  try {
    const decoded = atob(header.slice("Basic ".length).trim());
    const colon = decoded.indexOf(":");
    if (colon < 0) {
      return null;
    }
    return {
      user: decoded.slice(0, colon),
      password: decoded.slice(colon + 1),
    };
  } catch {
    return null;
  }
}

export function credentialsMatch(
  provided: { user: string; password: string } | null,
  env: AuthEnv = process.env,
): boolean {
  if (!provided) {
    return false;
  }
  const expectedUser = env.AUTH_USER?.trim() ?? "";
  const expectedPass = env.AUTH_PASSWORD ?? "";
  return provided.user === expectedUser && provided.password === expectedPass;
}

export function unauthorizedBasicResponse(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Places Discovery"',
      "Cache-Control": "no-store",
    },
  });
}
