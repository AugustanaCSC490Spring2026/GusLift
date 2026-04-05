import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

/**
 * GET — shared by /api/rider/schedule and /api/driver/schedule.
 * One schedule row per user_id; `days` holds the weekly JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseWithAuth(request);
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");

    const allowedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    if (day && !allowedDays.includes(day)) {
      return NextResponse.json(
        { error: "Invalid day. Use mon,tue,wed,thu,fri,sat,sun." },
        { status: 400 },
      );
    }

    const { data: rows, error: scheduleError } = await supabase
      .from("schedule")
      .select("days, pickup_loc, dropoff_loc")
      .eq("user_id", userId)
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
        { error: "No schedule found for this user" },
        { status: 404 },
      );
    }

    const { days, pickup_loc, dropoff_loc } = schedule;

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

    return NextResponse.json(
      {
        days,
        pickup_loc,
        dropoff_loc,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Schedule GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
