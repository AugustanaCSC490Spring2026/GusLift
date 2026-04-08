import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-id",
  );
  return res;
}

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
      return withCors(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");

    const allowedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    if (day && !allowedDays.includes(day)) {
      return withCors(
        NextResponse.json(
          { error: "Invalid day. Use mon,tue,wed,thu,fri,sat,sun." },
          { status: 400 },
        ),
      );
    }

    const { data: userRows, error: userError } = await supabase
      .from("User")
      .select("residence")
      .eq("id", userId)
      .limit(1);

    if (userError) {
      return withCors(
        NextResponse.json(
          { error: userError.message },
          { status: 500 },
        ),
      );
    }

    const residence = userRows?.[0]?.residence ?? null;

    const { data: rows, error: scheduleError } = await supabase
      .from("schedule")
      .select("days, pickup_loc, dropoff_loc")
      .eq("user_id", userId)
      .limit(1);

    if (scheduleError) {
      return withCors(
        NextResponse.json(
          { error: scheduleError.message },
          { status: 500 },
        ),
      );
    }

    const schedule = rows?.[0];

    if (!schedule) {
      const from = residence;
      return withCors(
        NextResponse.json(
          {
            days: null,
            from,
            pickup_loc: null,
            dropoff_loc: null,
            residence,
          },
          { status: 200 },
        ),
      );
    }

    const { days, pickup_loc, dropoff_loc } = schedule;
    const from = pickup_loc ?? residence;

    if (day) {
      const dayEntry = days?.[day];

      return withCors(
        NextResponse.json(
          {
            day,
            schedule: dayEntry
              ? {
                  ...dayEntry,
                  from,
                  pickup_loc,
                  dropoff_loc,
                  residence,
                }
              : null,
          },
          { status: 200 },
        ),
      );
    }

    return withCors(
      NextResponse.json(
        {
          days,
          from,
          pickup_loc,
          dropoff_loc,
          residence,
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    console.error("Schedule GET error:", error);
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
