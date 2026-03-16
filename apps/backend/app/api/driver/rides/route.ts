import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RideRow = {
  id: string;
  driver_id: string;
  rider_id: string;
  day: string | null;
  start_time: string | null;
  location: string | null;
  status: string;
  completed: boolean | null;
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

export async function GET(request: NextRequest) {
  try {
    const driverId = request.nextUrl.searchParams.get("driver_id")?.trim();
    if (!driverId) {
      return NextResponse.json(
        { error: "driver_id query param is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: rides, error: ridesError } = await supabase
      .from("rides")
      .select("id,driver_id,rider_id,day,start_time,location,status,completed,created_at")
      .eq("driver_id", driverId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (ridesError) {
      return NextResponse.json(
        { error: "Failed to fetch rides", details: ridesError.message },
        { status: 500 }
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
        return NextResponse.json(
          { error: "Failed to fetch rider profiles", details: ridersError.message },
          { status: 500 }
        );
      }

      ridersById = new Map(
        ((riders || []) as UserRow[]).map((rider) => [rider.id, rider])
      );
    }

    const items = rideRows.map((ride) => ({
      ...ride,
      rider: ridersById.get(ride.rider_id) || {
        id: ride.rider_id,
        name: null,
        residence: null,
        picture_url: null,
      },
    }));

    return NextResponse.json({
      success: true,
      driver_id: driverId,
      count: items.length,
      rides: items,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
