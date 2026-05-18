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
  const driverId = request.headers.get("x-user-id")?.trim();
  if (!rideId || !driverId) {
    return withCors(NextResponse.json({ error: "rideId and x-user-id are required" }, { status: 400 }));
  }

  let body: { code?: string } = {};
  try {
    body = await request.json();
  } catch {
    return withCors(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const submittedCode = String(body.code ?? "").trim();
  if (!submittedCode) {
    return withCors(NextResponse.json({ error: "code is required" }, { status: 400 }));
  }

  try {
    const supabase = getSupabase();

    const { data: ride, error: rideError } = await supabase
      .from("Rides")
      .select("id, driver_id, payment_code, payment_status")
      .eq("id", rideId)
      .maybeSingle();

    if (rideError) throw rideError;
    if (!ride) {
      return withCors(NextResponse.json({ error: "Ride not found" }, { status: 404 }));
    }
    if (ride.driver_id !== driverId) {
      return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }
    if (ride.payment_status === "verified") {
      return withCors(NextResponse.json({ success: true, already_verified: true }));
    }
    if (!ride.payment_code) {
      return withCors(NextResponse.json({ error: "No code has been issued for this ride" }, { status: 409 }));
    }
    if (ride.payment_code !== submittedCode) {
      return withCors(NextResponse.json({ error: "Incorrect code" }, { status: 422 }));
    }

    const { error: updateError } = await supabase
      .from("Rides")
      .update({ payment_status: "verified" })
      .eq("id", rideId);

    if (updateError) throw updateError;

    return withCors(NextResponse.json({ success: true }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
