import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type TokenBody = {
  token?: unknown;
  platform?: unknown;
  user_id?: unknown;
};

function getSupabaseWithServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE URL or SUPABASE service role key");
  }
  return createClient(url, serviceKey);
}

function parseAuthHeaderUserId(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.trim().length > 0 ? authHeader : null;
}

async function resolveUserId(
  request: NextRequest,
  bodyUserId?: string,
): Promise<string | null> {
  const fromHeader = request.headers.get("x-user-id")?.trim();
  if (fromHeader) return fromHeader;

  const bearer = parseAuthHeaderUserId(request.headers.get("Authorization"));
  if (!bearer) return bodyUserId?.trim() || null;

  const supabase = getSupabaseWithServiceRole();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(bearer.replace(/^Bearer\s+/i, "").trim());
  if (error || !user?.id) return bodyUserId?.trim() || null;
  return user.id;
}

function normalizeToken(rawToken: unknown): string | null {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  return token.length > 0 ? token : null;
}

function normalizePlatform(rawPlatform: unknown): string | null {
  if (typeof rawPlatform !== "string") return null;
  const platform = rawPlatform.trim().toLowerCase();
  if (!platform) return null;
  return platform;
}

export async function POST(request: NextRequest) {
  try {
    let body: TokenBody;
    try {
      body = (await request.json()) as TokenBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const token = normalizeToken(body.token);
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }
    const userId = await resolveUserId(
      request,
      typeof body.user_id === "string" ? body.user_id : undefined,
    );
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseWithServiceRole();
    const { error } = await supabase.from("PushTokens").upsert(
      {
        user_id: userId,
        token,
        platform: normalizePlatform(body.platform),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) {
      return NextResponse.json(
        { error: "Failed to store push token", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to register token",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: TokenBody = {};
    try {
      body = (await request.json()) as TokenBody;
    } catch {
      // body is optional for deactivation-all behavior
    }

    const userId = await resolveUserId(
      request,
      typeof body.user_id === "string" ? body.user_id : undefined,
    );
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseWithServiceRole();
    const token = normalizeToken(body.token);

    let query = supabase
      .from("PushTokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (token) {
      query = query.eq("token", token);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Failed to deactivate push token", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to deactivate token",
      },
      { status: 500 },
    );
  }
}
