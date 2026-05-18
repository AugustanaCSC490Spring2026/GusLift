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
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  return res;
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim();
  if (!userId) {
    return withCors(NextResponse.json({ error: "x-user-id header required" }, { status: 400 }));
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return withCors(NextResponse.json({ error: "Stripe not configured" }, { status: 503 }));
  }

  try {
    const supabase = getSupabase();

    // Get existing Stripe account ID if already created
    const { data: existing } = await supabase
      .from("driver_payment_settings")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      // Create a new Express connected account
      const createParams = new URLSearchParams();
      createParams.set("type", "express");
      createParams.set("metadata[user_id]", userId);

      const createRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: createParams.toString(),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err?.error?.message || "Failed to create Stripe account");
      }

      const account = await createRes.json();
      accountId = account.id;

      // Persist the account ID
      await supabase
        .from("driver_payment_settings")
        .upsert({ user_id: userId, stripe_account_id: accountId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }

    // Create an account link for onboarding
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
    const linkParams = new URLSearchParams();
    linkParams.set("account", accountId);
    linkParams.set("refresh_url", `${origin}/payments/stripe-refresh`);
    linkParams.set("return_url", `${origin}/payments/stripe-return`);
    linkParams.set("type", "account_onboarding");

    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkParams.toString(),
    });

    if (!linkRes.ok) {
      const err = await linkRes.json();
      throw new Error(err?.error?.message || "Failed to create account link");
    }

    const link = await linkRes.json();
    return withCors(NextResponse.json({ url: link.url, account_id: accountId }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
