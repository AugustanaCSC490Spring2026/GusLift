import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type RideRow = {
  id: string;
  driver_id: string;
  rider_id: string;
  ride_date: string | null;
  start_time: string | null;
  location: string | null;
  rider_dropoff_loc?: string | null;
  status: string;
  created_at: string | null;
};

/** ISO date-only strings parse as UTC midnight; weekday in local time can be wrong. Use UTC calendar date. */
const ISO_DOW_TO_DAY = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

function weekdayKeyFromIsoDate(
  rideDate: string | null | undefined,
): string | null {
  if (!rideDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rideDate).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const w = new Date(Date.UTC(y, mo, d)).getUTCDay();
  return ISO_DOW_TO_DAY[w] ?? null;
}

type DriverScheduleRow = {
  user_id: string;
  pickup_loc: string | null;
  dropoff_loc: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  residence: string | null;
  picture_url: string | null;
};

type CarRow = {
  user_id: string;
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string | null;
};

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
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  return res;
}

function getLocalTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function queryRides(
  supabase: ReturnType<typeof getSupabase>,
  opts: { driverId?: string; riderId?: string; limit?: number },
): Promise<{ rows: RideRow[]; error: PostgrestError | null }> {
  const rideSelect =
    "id,driver_id,rider_id,ride_date,start_time,location,rider_dropoff_loc,status,created_at";
  const todayDate = getLocalTodayDate();
  for (const tableName of ["Rides", "rides"]) {
    let query = supabase
      .from(tableName)
      .select(rideSelect)
      .eq("status", "accepted")
      .eq("ride_date", todayDate)
      .order("created_at", { ascending: false });

    if (opts.driverId) query = query.eq("driver_id", opts.driverId);
    if (opts.riderId) query = query.eq("rider_id", opts.riderId);
    if (typeof opts.limit === "number" && opts.limit > 0)
      query = query.limit(opts.limit);

    const { data, error } = await query;
    if (!error) {
      return { rows: (data || []) as RideRow[], error: null };
    }
  }

  return {
    rows: [],
    error: {
      message: "Unable to query rides from either Rides or rides table",
      details: "",
      hint: "",
      code: "RIDE_TABLE_MISSING",
    } as PostgrestError,
  };
}

export async function GET(request: NextRequest) {
  try {
    const driverId =
      request.nextUrl.searchParams.get("driver_id")?.trim() || undefined;
    const riderId =
      request.nextUrl.searchParams.get("rider_id")?.trim() || undefined;
    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    if (!driverId && !riderId) {
      return withCors(
        NextResponse.json(
          { error: "driver_id or rider_id query param is required" },
          { status: 400 },
        ),
      );
    }

    const supabase = getSupabase();
    const { rows: rideRows, error: ridesError } = await queryRides(supabase, {
      driverId,
      riderId,
      limit,
    });

    if (ridesError) {
      return withCors(
        NextResponse.json(
          { error: "Failed to fetch rides", details: ridesError.message },
          { status: 500 },
        ),
      );
    }

    const queriedDriverIds = Array.from(
      new Set(rideRows.map((ride) => ride.driver_id).filter(Boolean)),
    );
    const riderIds = Array.from(
      new Set(rideRows.map((ride) => ride.rider_id).filter(Boolean)),
    );

    let scheduleByDriver = new Map<string, DriverScheduleRow>();
    if (queriedDriverIds.length > 0) {
      const { data: schedules, error: schedulesError } = await supabase
        .from("schedule")
        .select("user_id,pickup_loc,dropoff_loc")
        .in("user_id", queriedDriverIds);
      if (schedulesError) {
        return withCors(
          NextResponse.json(
            {
              error: "Failed to fetch driver schedules",
              details: schedulesError.message,
            },
            { status: 500 },
          ),
        );
      }
      scheduleByDriver = new Map(
        ((schedules || []) as DriverScheduleRow[]).map((schedule) => [
          schedule.user_id,
          schedule,
        ]),
      );
    }

    let scheduleByRider = new Map<string, DriverScheduleRow>();
    if (riderIds.length > 0) {
      const { data: rSchedules, error: rSchedulesError } = await supabase
        .from("schedule")
        .select("user_id,pickup_loc,dropoff_loc")
        .in("user_id", riderIds);
      if (rSchedulesError) {
        return withCors(
          NextResponse.json(
            {
              error: "Failed to fetch rider schedules",
              details: rSchedulesError.message,
            },
            { status: 500 },
          ),
        );
      }
      scheduleByRider = new Map(
        ((rSchedules || []) as DriverScheduleRow[]).map((schedule) => [
          schedule.user_id,
          schedule,
        ]),
      );
    }

    const [ridersRes, driversRes, carsRes] = await Promise.all([
      riderIds.length
        ? supabase
            .from("User")
            .select("id,name,residence,picture_url")
            .in("id", riderIds)
        : Promise.resolve({ data: [], error: null }),
      queriedDriverIds.length
        ? supabase
            .from("User")
            .select("id,name,residence,picture_url")
            .in("id", queriedDriverIds)
        : Promise.resolve({ data: [], error: null }),
      queriedDriverIds.length
        ? supabase
            .from("Car")
            .select("user_id,make,model,color,license_plate")
            .in("user_id", queriedDriverIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ridersRes.error || driversRes.error || carsRes.error) {
      return withCors(
        NextResponse.json(
          {
            error: "Failed to fetch ride users/cars",
            details:
              ridersRes.error?.message ||
              driversRes.error?.message ||
              carsRes.error?.message,
          },
          { status: 500 },
        ),
      );
    }

    const ridersById = new Map(
      ((ridersRes.data || []) as UserRow[]).map((r) => [r.id, r]),
    );
    const driversById = new Map(
      ((driversRes.data || []) as UserRow[]).map((d) => [d.id, d]),
    );
    const carsByDriverId = new Map<string, CarRow>();
    for (const car of (carsRes.data || []) as CarRow[]) {
      if (!carsByDriverId.has(car.user_id)) {
        carsByDriverId.set(car.user_id, car);
      }
    }

    const items = rideRows.map((ride) => {
      const day = weekdayKeyFromIsoDate(ride.ride_date);
      const riderTo =
        ride.rider_dropoff_loc ??
        scheduleByRider.get(ride.rider_id)?.dropoff_loc ??
        null;

      return {
        ...ride,
        day,
        pickup_loc:
          scheduleByDriver.get(ride.driver_id)?.pickup_loc ??
          ride.location ??
          null,
        /** Rider destination: manual on accept, else saved schedule */
        dropoff_loc: riderTo,
        rider: ridersById.get(ride.rider_id) || {
          id: ride.rider_id,
          name: null,
          residence: null,
          picture_url: null,
        },
        driver: driversById.get(ride.driver_id) || {
          id: ride.driver_id,
          name: null,
          residence: null,
          picture_url: null,
        },
        car: carsByDriverId.get(ride.driver_id) || null,
      };
    });

    return withCors(
      NextResponse.json({
        success: true,
        driver_id: driverId ?? null,
        rider_id: riderId ?? null,
        count: items.length,
        rides: items,
      }),
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
