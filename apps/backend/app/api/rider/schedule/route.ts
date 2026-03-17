// Api endpoint to retrive the user's schedule for that particular day 

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Create a Supabase client that forwards the user's JWT
function getSupabaseWithAuth(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required.");
  }
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    },
  });
}

async function resolveUserId(request: NextRequest) {
  const fromHeader = request.headers.get("x-user-id")?.trim();
  if (fromHeader) return fromHeader;

  const fromQuery = request.nextUrl.searchParams.get("userID")?.trim();
  if (fromQuery) return fromQuery;

  const supabase = getSupabaseWithAuth(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) return null;
  return user.id;
}

// GET /api/rider/schedule?day=mon
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseWithAuth(request);
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Read `day` from query string (optional)
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day"); // e.g. "mon"

    const allowedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    if (day && !allowedDays.includes(day)) {
      return NextResponse.json(
        { error: "Invalid day. Use mon,tue,wed,thu,fri,sat,sun." },
        { status: 400 },
      );
    }

    // 3) Fetch this rider's schedule row
    const { data: rows, error: scheduleError } = await supabase
      .from("schedule")
      .select("days, pickup_loc, dropoff_loc")
      .eq("user_id", userId)
      .eq("is_driver", false)
      .limit(1);

    if (scheduleError) {
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 },
      );
    }

    const schedule = rows?.[0];

    if (!schedule) {
      return NextResponse.json(
        { error: "No schedule found for this rider" },
        { status: 404 },
      );
    }

    const { days, pickup_loc, dropoff_loc } = schedule;

    // 4) If a specific day is requested, return just that entry
    if (day) {
      const dayEntry = days?.[day];

      return NextResponse.json(
        {
          day,
          schedule: dayEntry
            ? {
                ...dayEntry,
                pickup_loc,
                dropoff_loc,
              }
            : null,
        },
        { status: 200 },
      );
    }

    // 5) Otherwise return the full days JSON + locations
    return NextResponse.json(
      {
        days,
        pickup_loc,
        dropoff_loc,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Rider schedule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}