/**
 * Extract Supabase user id from request.
 * Reads Bearer token from Authorization header or from query param "token".
 * Decodes JWT payload and returns "sub" (user id).
 * For production, verify JWT signature with SUPABASE_JWT_SECRET (e.g. via jose or similar).
 */
export function getTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

/**
 * Decode JWT payload without verification (payload is base64url).
 * Returns sub (user id) or null.
 */
export function decodeUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(decoded) as { sub?: string };
    return typeof obj.sub === "string" ? obj.sub : null;
  } catch {
    return null;
  }
}

export function authenticateRequest(request: Request): string | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return decodeUserIdFromToken(token);
}
