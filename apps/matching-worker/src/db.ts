import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  RESEND_FROM_EMAIL?: string;
  MATCHING_ROOM: DurableObjectNamespace;
};

export function getSupabase(env: Env): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export type UserRow = {
  id: string;
  residence: string | null;
};

export type ScheduleRow = {
  user_id: string;
  days: Record<string, { start_time: string; end_time: string }> | null;
};

/**
 * Fetch user residence and schedule for slot resolution.
 */
export async function fetchUserAndSchedule(
  env: Env,
  userId: string
): Promise<{ residence: string; schedule: ScheduleRow["days"] }> {
  const supabase = getSupabase(env);

  const [userRes, scheduleRes] = await Promise.all([
    supabase.from("User").select("id, residence").eq("id", userId).single(),
    supabase.from("schedule").select("user_id, days").eq("user_id", userId).single(),
  ]);

  if (userRes.error || !userRes.data) {
    throw new AuthError("User not found");
  }

  const residence = userRes.data.residence ?? "";
  const schedule = scheduleRes.data?.days ?? null;
  return { residence, schedule };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
