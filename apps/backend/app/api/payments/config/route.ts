import { NextResponse } from "next/server";

import { getStripeConfigStatus } from "@/lib/stripe-config";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json(getStripeConfigStatus(), {
      headers: {
        "Cache-Control": "no-store",
      },
    }),
  );
}
