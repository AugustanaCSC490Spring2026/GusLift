import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RideRow = {
  id: string;
  driver_id: string;
  rider_id: string;
  ride_date: string | null;
  start_time: string | null;
  location: string | null;
  status: string;
  created_at: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  residence: string | null;
  picture_url: string | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey);
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return res;
}

export async function GET(request: NextRequest) {
  try {
    const driverId = request.nextUrl.searchParams.get("driver_id")?.trim();
    if (!driverId) {
      return withCors(
        NextResponse.json(
          { error: "driver_id query param is required" },
          { status: 400 }
        )
      );
    }

    const supabase = getSupabase();

    // Supabase table is named "Rides" (quoted), so use that identifier
    const { data: rides, error: ridesError } = await supabase
      .from("Rides")
      .select("id,driver_id,rider_id,ride_date,start_time,location,status,created_at")
      .eq("driver_id", driverId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (ridesError) {
      return withCors(
        NextResponse.json(
          { error: "Failed to fetch rides", details: ridesError.message },
          { status: 500 }
        )
      );
    }

    const rideRows = (rides || []) as RideRow[];
    const riderIds = Array.from(
      new Set(rideRows.map((ride) => ride.rider_id).filter(Boolean))
    );

    let ridersById = new Map<string, UserRow>();
    if (riderIds.length > 0) {
      const { data: riders, error: ridersError } = await supabase
        .from("User")
        .select("id,name,residence,picture_url")
        .in("id", riderIds);

      if (ridersError) {
        return withCors(
          NextResponse.json(
            {
              error: "Failed to fetch rider profiles",
              details: ridersError.message,
            },
            { status: 500 }
          )
        );
      }

      ridersById = new Map(
        ((riders || []) as UserRow[]).map((rider) => [rider.id, rider])
      );
    }

    const items = rideRows.map((ride) => {
      let day: string | null = null;
      if (ride.ride_date) {
        try {
          const d = new Date(ride.ride_date);
          // mon/tue/... to align with mobile DAY_LABELS keys
          day = d
            .toLocaleDateString("en-US", { weekday: "short" })
            .toLowerCase()
            .slice(0, 3);
        } catch {
          day = null;
        }
      }

      return {
        ...ride,
        day,
        rider: ridersById.get(ride.rider_id) || {
          id: ride.rider_id,
          name: null,
          residence: null,
          picture_url: null,
        },
      };
    });

    return withCors(
      NextResponse.json({
        success: true,
        driver_id: driverId,
        count: items.length,
        rides: items,
      })
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Internal server error",
        },
        { status: 500 }
      )
    );
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
