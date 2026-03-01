import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create bucket "driver-pictures" in Supabase Dashboard → Storage and allow public read if needed
const BUCKET_NAME = "driver-pictures";

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const userID = formData.get("userID") as string | null;
    const name = formData.get("name") as string | null;
    const residence = formData.get("residence") as string | null;
    const picture = formData.get("picture") as File | null;

    const make = formData.get("make") as string | null;
    const model = formData.get("model") as string | null;
    const color = formData.get("color") as string | null;
    const license_plate = formData.get("license_plate") as string | null;
    const capacityStr = formData.get("capacity") as string | null;

    const scheduleIsDriver = formData.get("schedule_is_driver") as string | null;
    const daysStr = formData.get("days") as string | null;
    const pickup_loc = formData.get("pickup_loc") as string | null;
    const dropoff_loc = formData.get("dropoff_loc") as string | null;
    const start_time = formData.get("start_time") as string | null;
    const end_time = formData.get("end_time") as string | null;

    if (!userID?.trim()) {
      return NextResponse.json(
        { error: "userID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    let picture_url: string | null = null;
    if (picture && picture.size > 0) {
      const ext =
        picture.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ? ext
        : "jpg";
      const path = `${userID}/avatar.${safeExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, picture, {
          contentType: picture.type || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image", details: uploadError.message },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
      picture_url = publicUrl;
    }

    const is_driver = true;

    const { error: userError } = await supabase.from("User").upsert(
      {
        id: userID.trim(),
        name: name?.trim() ?? null,
        residence: residence?.trim() ?? null,
        picture_url,
        is_driver,
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("User upsert error:", userError);
      return NextResponse.json(
        { error: "Failed to save user", details: userError.message },
        { status: 500 }
      );
    }

    const capacity = capacityStr != null ? parseInt(capacityStr, 10) : null;
    if (
      make != null ||
      model != null ||
      color != null ||
      license_plate != null ||
      (capacity != null && !Number.isNaN(capacity))
    ) {
      const { error: carError } = await supabase.from("Car").insert({
        user_id: userID.trim(),
        make: make?.trim() ?? null,
        model: model?.trim() ?? null,
        color: color?.trim() ?? null,
        license_plate: license_plate?.trim() ?? null,
        capacity: Number.isNaN(capacity) ? null : capacity,
      });

      if (carError) {
        console.error("Car insert error:", carError);
        return NextResponse.json(
          { error: "Failed to save car", details: carError.message },
          { status: 500 }
        );
      }
    }

    let daysJson: unknown = null;
    if (daysStr?.trim()) {
      try {
        daysJson = JSON.parse(daysStr) as unknown;
      } catch {
        daysJson = daysStr;
      }
    }

    const hasSchedule =
      pickup_loc != null ||
      dropoff_loc != null ||
      start_time != null ||
      end_time != null ||
      daysStr != null;

    if (hasSchedule) {
      const scheduleIsDriverBool =
        scheduleIsDriver === "true" || scheduleIsDriver === "1";

      const { error: scheduleError } = await supabase.from("schedule").insert({
        user_id: userID.trim(),
        is_driver: scheduleIsDriverBool,
        days: daysJson,
        pickup_loc: pickup_loc?.trim() ?? null,
        dropoff_loc: dropoff_loc?.trim() ?? null,
        start_time: start_time?.trim() || null,
        end_time: end_time?.trim() || null,
      });

      if (scheduleError) {
        console.error("Schedule insert error:", scheduleError);
        return NextResponse.json(
          { error: "Failed to save schedule", details: scheduleError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user_id: userID.trim(),
      picture_url,
    });
  } catch (err) {
    console.error("Driver API error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
