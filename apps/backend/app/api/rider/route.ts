import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Supabase client that forwards the user's JWT
 * so we can verify the authenticated user.
 */
function getSupabaseWithAuth(request: NextRequest) {
  // Accept either name so a single .env works whether it was scaffolded for
  // a Next.js client (NEXT_PUBLIC_*) or a generic server context (SUPABASE_*).
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).",
    );
  }
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  // Forward the user's JWT *only* if the client sent one, so supabase.auth.getUser()
  // can verify the request in resolveUserId's fallback path. If we always set the
  // Authorization header — even to an empty string — we blow away the SDK's default
  // `Bearer <serviceRoleKey>` value, and Supabase Storage then rejects uploads with
  // "headers must have required property 'authorization'". The mobile app currently
  // identifies users by userID in the body, so the Authorization header is absent
  // and the service-role default is what we actually want here.
  const authHeader = request.headers.get("Authorization");
  return createClient(supabaseUrl, supabaseKey, {
    ...(authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : {}),
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
    const email = formData.get("email") as string | null;
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

    // Chain .select() so we get back the actual rows written. Without this,
    // supabase-js defaults to Prefer: return=minimal and a successful HTTP
    // response can hide a zero-row write (e.g. RLS filtering, or an Authorization
    // header that downgraded us to anon). Using returned row count as the source
    // of truth makes silent failures impossible.
    const { data: userRows, error: userError } = await supabase
      .from("User")
      .upsert({
        id: resolvedUserId,
        name,
        residence,
        ...(picture_url ? { picture_url } : {}),
        is_driver: false,
      })
      .select();

    if (userError) {
      console.error("User upsert error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
    if (!userRows || userRows.length === 0) {
      console.error("User upsert returned 0 rows", { resolvedUserId });
      return NextResponse.json(
        { error: "User row was not written (RLS or schema issue)." },
        { status: 500 },
      );
    }

    // Upsert so re-registration updates the existing schedule instead of failing
    const { data: scheduleRows, error: scheduleError } = await supabase
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
      )
      .select();

    if (scheduleError) {
      console.error("Schedule upsert error:", scheduleError);
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 },
      );
    }
    if (!scheduleRows || scheduleRows.length === 0) {
      console.error("Schedule upsert returned 0 rows", { resolvedUserId });
      return NextResponse.json(
        { error: "Schedule row was not written (RLS or schema issue)." },
        { status: 500 },
      );
    }

    console.log("Rider registered", {
      userId: resolvedUserId,
      scheduleId: scheduleRows[0]?.id,
      days: Object.keys(daysJson ?? {}),
    });

    return NextResponse.json(
      {
        message: "Rider registered successfully",
        user: userRows[0],
        schedule: scheduleRows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Rider registration error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
