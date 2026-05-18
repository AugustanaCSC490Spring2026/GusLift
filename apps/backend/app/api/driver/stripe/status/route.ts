import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getStripeSecretKey } from "@/lib/stripe-config";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  return res;
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim();
  if (!userId) {
    return withCors(NextResponse.json({ error: "x-user-id header required" }, { status: 400 }));
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return withCors(NextResponse.json({ onboarded: false, reason: "Stripe not configured" }));
  }

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("driver_payment_settings")
      .select("stripe_account_id, stripe_onboarded")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.stripe_account_id) {
      return withCors(NextResponse.json({ onboarded: false, reason: "no_account" }));
    }

    // Check current onboarding status from Stripe
    const res = await fetch(`https://api.stripe.com/v1/accounts/${data.stripe_account_id}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok) {
      return withCors(NextResponse.json({ onboarded: data.stripe_onboarded ?? false, reason: "stripe_fetch_failed" }));
    }

    const account = await res.json();
    const onboarded = account.details_submitted === true && account.charges_enabled === true;

    if (onboarded && !data.stripe_onboarded) {
      await supabase
        .from("driver_payment_settings")
        .update({ stripe_onboarded: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return withCors(NextResponse.json({ onboarded, account_id: data.stripe_account_id }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
