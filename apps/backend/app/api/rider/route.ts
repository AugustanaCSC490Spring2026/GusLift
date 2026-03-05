import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Supabase client that forwards the user's JWT
 * so we can verify the authenticated user.
 */
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

export async function POST(request: NextRequest) {
  try {
    //  Create supabase client with JWT from request
    const supabase = getSupabaseWithAuth(request);

    // Get authenticated user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      name,
      residence,
      picture_url,
      days,
      pickup_loc,
      dropoff_loc,
    } = body;


    if (!name || !residence || !days || !pickup_loc || !dropoff_loc) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }


    const { error: userError } = await supabase.from("User").upsert({
      id: user.id,
      name,
      residence,
      picture_url,
      is_driver: false,
    });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

   
    const { error: scheduleError } = await supabase
      .from("schedule")
      .insert({
        user_id: user.id,
        is_driver: false,
        days,
        pickup_loc,
        dropoff_loc,
      });

    if (scheduleError) {
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 },
      );
    }

    // 7️⃣ Success response
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
