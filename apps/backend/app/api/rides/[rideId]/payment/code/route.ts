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
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  return res;
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rideId: string }> },
) {
  const { rideId } = await params;
  const riderId = request.headers.get("x-user-id")?.trim();
  if (!rideId || !riderId) {
    return withCors(NextResponse.json({ error: "rideId and x-user-id are required" }, { status: 400 }));
  }

  let body: { payment_method?: string; fare_cents?: number } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  try {
    const supabase = getSupabase();

    // Confirm the ride belongs to this rider
    const { data: ride, error: rideError } = await supabase
      .from("Rides")
      .select("id, rider_id, payment_status, payment_code")
      .eq("id", rideId)
      .maybeSingle();

    if (rideError) throw rideError;
    if (!ride) {
      return withCors(NextResponse.json({ error: "Ride not found" }, { status: 404 }));
    }
    if (ride.rider_id !== riderId) {
      return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }

    // Return existing code if already issued
    if (ride.payment_status === "code_issued" && ride.payment_code) {
      return withCors(NextResponse.json({ code: ride.payment_code, already_issued: true }));
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));

    const patch: Record<string, unknown> = {
      payment_code: code,
      payment_status: "code_issued",
    };
    if (body.payment_method) patch.payment_method = body.payment_method;
    if (typeof body.fare_cents === "number") patch.fare_cents = body.fare_cents;

    const { error: updateError } = await supabase
      .from("Rides")
      .update(patch)
      .eq("id", rideId);

    if (updateError) throw updateError;

    return withCors(NextResponse.json({ code }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
