import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Supabase client that forwards the user's JWT
 * so we can verify the authenticated user.
 */
function getSupabaseWithAuth(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY 

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

async function resolveUserId(request: NextRequest, userIDFromBody?: string) {
  const fromBody = userIDFromBody?.trim();
  if (fromBody) return fromBody;

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

const BUCKET_NAME = "driver-pictures"; // We can use the same bucket or a different one. Let's use rider-pictures if you want? Actually let's just create a general user-pictures or use driver-pictures. Wait, let's use the same bucket logic as driver for consistency.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const userID = formData.get("userID") as string | null;
    const name = formData.get("name") as string | null;
    const residence = formData.get("residence") as string | null;
    const pickup_loc = formData.get("pickup_loc") as string | null;
    const dropoff_loc = formData.get("dropoff_loc") as string | null;
    const daysStr = formData.get("days") as string | null;
    const picture = formData.get("picture") as File | null;

    if (!userID || !name || !residence || !daysStr || !pickup_loc || !dropoff_loc) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const resolvedUserId = await resolveUserId(request, userID);
    if (!resolvedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseWithAuth(request);

    let picture_url: string | null = null;
    if (picture && picture.size > 0) {
      const ext = picture.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ? ext
        : "jpg";
      const path = `${resolvedUserId}/avatar.${safeExt}`;

      // Using same bucket as driver for simplicity, or we can use "avatars". The driver uses "driver-pictures". Let's stick with "driver-pictures" for now or just avoid uploading if the bucket doesn't exist. Actually, let's just use "driver-pictures" as it'll work since the bucket exists.
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("driver-pictures")
        .upload(path, picture, {
          contentType: picture.type || "image/jpeg",
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("driver-pictures").getPublicUrl(uploadData.path);
        picture_url = publicUrl;
      } else {
        console.error("Storage upload error:", uploadError);
      }
    }

    let daysJson = null;
    try {
      daysJson = JSON.parse(daysStr);
    } catch {
      return NextResponse.json({ error: "Invalid days format" }, { status: 400 });
    }

    const { error: userError } = await supabase.from("User").upsert({
      id: resolvedUserId,
      name,
      residence,
      ...(picture_url ? { picture_url } : {}),
      is_driver: false,
    });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Upsert so re-registration updates the existing schedule instead of failing
    const { error: scheduleError } = await supabase
      .from("schedule")
      .upsert(
        {
          user_id: resolvedUserId,
          is_driver: false,
          days: daysJson,
          pickup_loc,
          dropoff_loc,
        },
        { onConflict: "user_id" }
      );

    if (scheduleError) {
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Rider registered successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Rider registration error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
