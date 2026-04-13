import { NextResponse } from "next/server";

import { getStripeConfigStatus } from "@/lib/stripe-config";

export async function GET() {
  return NextResponse.json(getStripeConfigStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
