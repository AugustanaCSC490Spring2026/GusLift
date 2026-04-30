import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DaySchedule = { start_time: string; end_time: string };
type DaysJson = Partial<Record<DayKey, DaySchedule>>;

// Create bucket "driver-pictures" in Supabase Dashboard → Storage and allow public read if needed
const BUCKET_NAME = "driver-pictures";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const userID = formData.get("userID") as string | null;
    const name = formData.get("name") as string | null;
    const email = formData.get("email") as string | null;
    const residence = formData.get("residence") as string | null;
    const picture = formData.get("picture") as File | null;

    const make = formData.get("make") as string | null;
    const model = formData.get("model") as string | null;
    const color = formData.get("color") as string | null;
    const license_plate = formData.get("license_plate") as string | null;
    const capacityStr = formData.get("capacity") as string | null;

    const isDriverStr = formData.get("is_driver") as string | null;
    const daysStr = formData.get("days") as string | null;

    if (!userID?.trim()) {
      return NextResponse.json(
        { error: "userID is required" },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    let picture_url: string | null = null;
    if (picture && picture.size > 0) {
      const ext = picture.name.split(".").pop()?.toLowerCase() || "jpg";
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
          { status: 500 },
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
      picture_url = publicUrl;
    }

    const is_driver = isDriverStr === "true" || isDriverStr === "1";

    const { error: userError } = await supabase.from("User").upsert(
      {
        id: userID.trim(),
        name: name?.trim() ?? null,
        email: email?.trim() || null,
        residence: residence?.trim() ?? null,
        picture_url,
        is_driver,
      },
      { onConflict: "id" },
    );

    if (userError) {
      console.error("User upsert error:", userError);
      return NextResponse.json(
        { error: "Failed to save user", details: userError.message },
        { status: 500 },
      );
    }

    let capacity: number | null = null;
    if (capacityStr != null && capacityStr.trim() !== "") {
      const normalized = capacityStr.trim();
      if (!/^\d+$/.test(normalized)) {
        return NextResponse.json(
          { error: "capacity must be a whole number" },
          { status: 400 },
        );
      }
      const parsed = Number(normalized);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) {
        return NextResponse.json(
          { error: "capacity must be an integer between 1 and 8" },
          { status: 400 },
        );
      }
      capacity = parsed;
    }
    if (
      make != null ||
      model != null ||
      color != null ||
      license_plate != null ||
      capacity != null
    ) {
      // user_id is intentionally non-unique to support multiple cars per driver.
      const { error: carError } = await supabase.from("Car").insert({
        user_id: userID.trim(),
        make: make?.trim() ?? null,
        model: model?.trim() ?? null,
        color: color?.trim() ?? null,
        license_plate: license_plate?.trim() ?? null,
        capacity,
      });

      if (carError) {
        console.error("Car insert error:", carError);
        return NextResponse.json(
          { error: "Failed to save car", details: carError.message },
          { status: 500 },
        );
      }
    }

    let daysJson: DaysJson | null = null;
    if (daysStr?.trim()) {
      try {
        const parsed = JSON.parse(daysStr) as DaysJson;
        daysJson = parsed;
      } catch {
        daysJson = null;
      }
    }

    if (daysJson) {
      const { error: scheduleError } = await supabase.from("schedule").upsert(
        {
          user_id: userID.trim(),
          is_driver,
          days: daysJson,
        },
        { onConflict: "user_id" },
      );

      if (scheduleError) {
        console.error("Schedule insert error:", scheduleError);
        return NextResponse.json(
          { error: "Failed to save schedule", details: scheduleError.message },
          { status: 500 },
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
      { status: 500 },
    );
  }
}
