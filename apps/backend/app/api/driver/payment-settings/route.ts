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
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  return res;
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id")?.trim();
  if (!userId) {
    return withCors(NextResponse.json({ error: "user_id is required" }, { status: 400 }));
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("driver_payment_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return withCors(NextResponse.json({ settings: data ?? null }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim();
  if (!userId) {
    return withCors(NextResponse.json({ error: "x-user-id header required" }, { status: 400 }));
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const allowed = ["venmo_username", "cashapp_username", "cashapp_qr_url", "zelle_contact", "accepts_cash", "preferred_order"];
  const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("driver_payment_settings")
      .upsert(patch, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return withCors(NextResponse.json({ settings: data }));
  } catch (err) {
    return withCors(
      NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 }),
    );
  }
}
