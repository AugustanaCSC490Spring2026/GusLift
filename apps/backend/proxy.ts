import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Expo web (e.g. localhost:8081) calls the Next API on another origin (localhost:3000).
 * Browsers require CORS headers or the response is blocked and fetch() fails (no redirect).
 */
function corsOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (!origin) return "*";
  const allowedEnv = process.env.CORS_ALLOW_ORIGIN;
  if (allowedEnv) return allowedEnv;
  // Local dev: Metro / Expo on common hosts
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
      origin,
    )
  ) {
    return origin;
  }
  return origin;
}

function withCors(request: NextRequest, response: NextResponse) {
  const o = corsOrigin(request);
  response.headers.set("Access-Control-Allow-Origin", o);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, x-user-id, X-User-Id",
  );
  if (o !== "*") {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    return withCors(request, res);
  }

  const res = NextResponse.next();
  return withCors(request, res);
}

export const config = {
  matcher: "/api/:path*",
};
