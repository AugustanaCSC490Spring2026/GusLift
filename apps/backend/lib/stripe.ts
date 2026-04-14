import { requireStripeConfig } from "@/lib/stripe-config";

export type StripeCheckoutSessionSummary = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  payment_intent_id: string | null;
  ride_id: string | null;
  rider_id: string | null;
};

type CreateCheckoutSessionInput = {
  requestOrigin: string;
  amountCents: number;
  rideLabel: string;
  rideId?: string | null;
  userId?: string | null;
  email?: string | null;
  returnUrl?: string | null;
};

function getStripeHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function parseStripeResponse(response: Response) {
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Stripe request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null || !currency) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export async function createCheckoutSession({
  requestOrigin,
  amountCents,
  rideLabel,
  rideId,
  userId,
  email,
  returnUrl,
}: CreateCheckoutSessionInput): Promise<StripeCheckoutSessionSummary> {
  const { secretKey } = requireStripeConfig();

  const successUrl = new URL("/payments/success", requestOrigin);
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  if (rideId) {
    successUrl.searchParams.set("ride_id", rideId);
  }
  if (returnUrl) {
    successUrl.searchParams.set("return_url", returnUrl);
  }

  const cancelUrl = new URL("/payments/cancel", requestOrigin);
  if (rideId) {
    cancelUrl.searchParams.set("ride_id", rideId);
  }
  if (returnUrl) {
    cancelUrl.searchParams.set("return_url", returnUrl);
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl.toString());
  params.set("cancel_url", cancelUrl.toString());
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][product_data][name]",
    rideLabel || "GusLift Demo Ride Payment",
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    "Sprint 2 demo checkout session for GusLift.",
  );
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set("submit_type", "pay");
  params.set("metadata[demo_mode]", "true");

  if (rideId) {
    params.set("metadata[ride_id]", rideId);
  }
  if (userId) {
    params.set("client_reference_id", userId);
    params.set("metadata[rider_id]", userId);
  }
  if (email) {
    params.set("customer_email", email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: getStripeHeaders(secretKey),
    body: params.toString(),
    cache: "no-store",
  });

  const session = await parseStripeResponse(response);
  return summarizeCheckoutSession(session);
}

export async function retrieveCheckoutSession(sessionId: string) {
  const { secretKey } = requireStripeConfig();

  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );

  const session = await parseStripeResponse(response);
  return summarizeCheckoutSession(session);
}

function summarizeCheckoutSession(
  session: Record<string, unknown>,
): StripeCheckoutSessionSummary {
  const customerDetails =
    session.customer_details &&
    typeof session.customer_details === "object" &&
    !Array.isArray(session.customer_details)
      ? (session.customer_details as Record<string, unknown>)
      : null;

  const metadata =
    session.metadata &&
    typeof session.metadata === "object" &&
    !Array.isArray(session.metadata)
      ? (session.metadata as Record<string, unknown>)
      : null;

  return {
    id: String(session.id || ""),
    url: typeof session.url === "string" ? session.url : null,
    status: typeof session.status === "string" ? session.status : null,
    payment_status:
      typeof session.payment_status === "string"
        ? session.payment_status
        : null,
    amount_total:
      typeof session.amount_total === "number" ? session.amount_total : null,
    currency: typeof session.currency === "string" ? session.currency : null,
    customer_email:
      customerDetails && typeof customerDetails.email === "string"
        ? customerDetails.email
        : null,
    payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    ride_id:
      metadata && typeof metadata.ride_id === "string" ? metadata.ride_id : null,
    rider_id:
      metadata && typeof metadata.rider_id === "string" ? metadata.rider_id : null,
  };
}
