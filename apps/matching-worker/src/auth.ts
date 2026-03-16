/**
 * Extract user id from request.
 * Reads from Authorization header (Bearer <userId>) or from query param "token".
 */
export function authenticateRequest(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const url = new URL(request.url);
  return url.searchParams.get("token") || null;
}
