import { NextRequest, NextResponse } from "next/server";

import {
  createCheckoutSession,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import { upsertRidePayment } from "@/lib/ride-payments";
import { getStripeConfigStatus } from "@/lib/stripe-config";

const DEMO_AMOUNT_CENTS = 500;

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();

  if (!sessionId) {
    return withCors(
      NextResponse.json(
        { error: "session_id query parameter is required" },
        { status: 400 },
      ),
    );
  }

  try {
    const session = await retrieveCheckoutSession(sessionId);
    return withCors(NextResponse.json(session));
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unable to load session",
        },
        { status: 500 },
      ),
    );
  }
}

export async function POST(request: NextRequest) {
  const stripeStatus = getStripeConfigStatus();
  if (!stripeStatus.ready) {
    return withCors(
      NextResponse.json(
        {
          error: "Stripe is not configured yet",
          stripe: stripeStatus,
        },
        { status: 503 },
      ),
    );
  }

  let body: {
    amount?: unknown;
    rideLabel?: unknown;
    rideId?: unknown;
    returnUrl?: unknown;
    userId?: unknown;
    email?: unknown;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const requestedAmount = Number(body.amount);
  const amountCents =
    Number.isInteger(requestedAmount) && requestedAmount >= 100
      ? requestedAmount
      : DEMO_AMOUNT_CENTS;
  const rideLabel =
    typeof body.rideLabel === "string" && body.rideLabel.trim()
      ? body.rideLabel.trim()
      : "GusLift Demo Ride Payment";
  const rideId =
    typeof body.rideId === "string" && body.rideId.trim()
      ? body.rideId.trim()
      : null;
  const returnUrl =
    typeof body.returnUrl === "string" && body.returnUrl.trim()
      ? body.returnUrl.trim()
      : null;
  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : null;
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;

  try {
    const session = await createCheckoutSession({
      requestOrigin: request.nextUrl.origin,
      amountCents,
      rideLabel,
      rideId,
      userId,
      email,
      returnUrl,
    });

    if (rideId) {
      await upsertRidePayment({
        rideId,
        riderId: userId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent_id,
        amountCents,
        currency: session.currency || "usd",
        customerEmail: email,
        checkoutUrl: session.url,
        status: "checkout_created",
        stripeSessionStatus: session.status,
        stripePaymentStatus: session.payment_status,
      });
    }

    return withCors(
      NextResponse.json({
        ...session,
        amountCents,
        demoMode: true,
        rideId,
      }),
    );
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to create checkout session",
        },
        { status: 500 },
      ),
    );
  }
}
