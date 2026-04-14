import { createClient } from "@supabase/supabase-js";

export type RidePaymentStatus =
  | "checkout_created"
  | "paid"
  | "canceled"
  | "failed";

type UpsertRidePaymentInput = {
  rideId: string;
  riderId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  amountCents: number;
  currency: string;
  customerEmail?: string | null;
  checkoutUrl?: string | null;
  status: RidePaymentStatus;
  stripeSessionStatus?: string | null;
  stripePaymentStatus?: string | null;
  paidAt?: string | null;
};

type UpdateRidePaymentStatusInput = {
  rideId: string;
  status: RidePaymentStatus;
  stripeSessionStatus?: string | null;
  stripePaymentStatus?: string | null;
  paidAt?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey);
}

export async function upsertRidePayment({
  rideId,
  riderId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  amountCents,
  currency,
  customerEmail,
  checkoutUrl,
  status,
  stripeSessionStatus,
  stripePaymentStatus,
  paidAt,
}: UpsertRidePaymentInput) {
  const supabase = getSupabaseAdmin();

  const payload = {
    ride_id: rideId,
    rider_id: riderId ?? null,
    stripe_checkout_session_id: stripeCheckoutSessionId ?? null,
    stripe_payment_intent_id: stripePaymentIntentId ?? null,
    amount_cents: amountCents,
    currency,
    customer_email: customerEmail ?? null,
    checkout_url: checkoutUrl ?? null,
    status,
    stripe_session_status: stripeSessionStatus ?? null,
    stripe_payment_status: stripePaymentStatus ?? null,
    paid_at: paidAt ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("RidePayments")
    .upsert(payload, { onConflict: "ride_id" });

  if (error) {
    throw new Error(`Failed to upsert RidePayments row: ${error.message}`);
  }
}

export async function updateRidePaymentStatus({
  rideId,
  status,
  stripeSessionStatus,
  stripePaymentStatus,
  paidAt,
}: UpdateRidePaymentStatusInput) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("RidePayments")
    .update({
      status,
      stripe_session_status: stripeSessionStatus ?? null,
      stripe_payment_status: stripePaymentStatus ?? null,
      paid_at: paidAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("ride_id", rideId);

  if (error) {
    throw new Error(`Failed to update RidePayments row: ${error.message}`);
  }
}
