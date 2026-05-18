import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rideId: string }> },
) {
  const { rideId } = await params;
  if (!rideId) {
    return withCors(NextResponse.json({ error: "rideId is required" }, { status: 400 }));
  }

  try {
    const supabase = getSupabase();

    const { data: ride, error: rideError } = await supabase
      .from("Rides")
      .select("id, driver_id, rider_id, location, rider_dropoff_loc, fare_cents, payment_code, payment_status, payment_method")
      .eq("id", rideId)
      .maybeSingle();

    if (rideError) throw rideError;
    if (!ride) {
      return withCors(NextResponse.json({ error: "Ride not found" }, { status: 404 }));
    }

    const { data: driverSettings } = await supabase
      .from("driver_payment_settings")
      .select("venmo_username, cashapp_username, cashapp_qr_url, zelle_contact, accepts_cash, stripe_onboarded, preferred_order")
      .eq("user_id", ride.driver_id)
      .maybeSingle();

    return withCors(
      NextResponse.json({
        ride_id: ride.id,
        pickup_loc: ride.location,
        dropoff_loc: ride.rider_dropoff_loc,
        fare_cents: ride.fare_cents,
        payment_status: ride.payment_status ?? "pending",
        payment_method: ride.payment_method,
        payment_code: ride.payment_status === "verified" ? ride.payment_code : null,
        driver_payment: driverSettings ?? null,
      }),
    );
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
