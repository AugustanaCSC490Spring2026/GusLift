// Api endpoint to retrive the user's schedule for that particular day 

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Create a Supabase client that forwards the user's JWT
function getSupabaseWithAuth(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    },
  });
}

// GET /api/rider/schedule?day=mon
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseWithAuth(request);

    // 1) Auth: who is this user?
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
      .eq("user_id", user.id)
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