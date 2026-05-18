import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function normRideId(id: string | number | null | undefined): string {
  if (id == null || id === "") return "";
  const s = String(id).trim();
  if (/^\d+$/.test(s)) return String(Number(s));
  return s.toLowerCase();
}

function userIdVariants(raw: string): string[] {
  return Array.from(
    new Set(
      [raw, raw.toLowerCase(), raw.toUpperCase()].filter((s) => s.length > 0),
    ),
  );
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, serviceKey);
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-id, X-User-Id",
  );
  return res;
}

export async function POST(request: NextRequest) {
  try {
    let body: {
      ride_id?: unknown;
      from_user_id?: unknown;
      to_user_id?: unknown;
      score?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return withCors(
        NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      );
    }

    const ride_id =
      normRideId(body.ride_id) || String(body.ride_id ?? "").trim();
    const from_user_id = String(body.from_user_id ?? "").trim();
    const to_user_id = String(body.to_user_id ?? "").trim();
    const score = Number(body.score);

    if (!ride_id || !from_user_id || !to_user_id) {
      return withCors(
        NextResponse.json(
          { error: "ride_id, from_user_id, and to_user_id are required" },
          { status: 400 },
        ),
      );
    }

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return withCors(
        NextResponse.json(
          { error: "score must be an integer between 1 and 5" },
          { status: 400 },
        ),
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("ratings")
      .upsert(
        {
          ride_id,
          from_user_id,
          to_user_id,
          score,
        },
        { onConflict: "ride_id,from_user_id" },
      )
      .select("id,ride_id,from_user_id,to_user_id,score,created_at")
      .single();

    if (error) {
      console.error("[ratings POST] Supabase error:", error);
      return withCors(
        NextResponse.json(
          { error: "Failed to save rating", details: error.message },
          { status: 500 },
        ),
      );
    }

    return withCors(NextResponse.json({ success: true, rating: data }));
  } catch (err) {
    return withCors(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Internal server error" },
        { status: 500 },
      ),
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userIdRaw = request.nextUrl.searchParams.get("user_id")?.trim();
    const userId = userIdRaw ? String(userIdRaw) : undefined;

    if (!userId) {
      return withCors(
        NextResponse.json(
          { error: "user_id query param is required" },
          { status: 400 },
        ),
      );
    }

    const supabase = getSupabase();
    const idVariants = userIdVariants(userId);
    const { data, error } = await supabase
      .from("ratings")
      .select("score")
      .in("to_user_id", idVariants);

    if (error) {
      return withCors(
        NextResponse.json(
          { error: "Failed to fetch ratings", details: error.message },
          { status: 500 },
        ),
      );
    }

    const rows = data || [];
    const count = rows.length;
    const average =
      count > 0
        ? Math.round(
            (rows.reduce((sum, r) => sum + r.score, 0) / count) * 10,
          ) / 10
        : null;

    return withCors(
      NextResponse.json({ success: true, user_id: userId, average, count }),
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Internal server error" },
        { status: 500 },
      ),
    );
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
