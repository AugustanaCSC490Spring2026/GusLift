
export function authenticateRequest(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

