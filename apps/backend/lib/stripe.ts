import { requireStripeConfig } from "@/lib/stripe-config";

export type StripeCheckoutSessionSummary = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
};

type CreateCheckoutSessionInput = {
  requestOrigin: string;
  amountCents: number;
  rideLabel: string;
  userId?: string | null;
  email?: string | null;
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
  userId,
  email,
}: CreateCheckoutSessionInput): Promise<StripeCheckoutSessionSummary> {
  const { secretKey } = requireStripeConfig();

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set(
    "success_url",
    `${requestOrigin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${requestOrigin}/payments/cancel`);
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

  if (userId) {
    params.set("client_reference_id", userId);
    params.set("metadata[user_id]", userId);
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
  };
}
