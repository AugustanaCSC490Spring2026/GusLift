import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string | null;
  sendEmail?: boolean;
};

type UserContactRow = {
  email: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey);
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  data = {},
  idempotencyKey = null,
  sendEmail: shouldSendEmail = false,
}: CreateNotificationInput) {
  const supabase = getSupabaseAdmin();
  let emailTo: string | null = null;
  let emailStatus: string | null = null;
  let emailSentAt: string | null = null;
  let emailError: string | null = null;

  if (shouldSendEmail) {
    const { data: userRow } = await supabase
      .from("User")
      .select("email")
      .eq("id", userId)
      .single<UserContactRow>();
    emailTo = userRow?.email ?? null;

    if (!emailTo) {
      emailStatus = "skipped";
      emailError = "User email is missing";
    } else {
      const result = await sendEmail({
        to: emailTo,
        subject: title,
        text: body,
      });
      if (result.ok) {
        emailStatus = "sent";
        emailSentAt = new Date().toISOString();
      } else {
        emailStatus = "failed";
        emailError = result.error;
      }
    }
  }

  const payload = {
    user_id: userId,
    type,
    title,
    body,
    data,
    idempotency_key: idempotencyKey,
    email_to: emailTo,
    email_status: emailStatus,
    email_sent_at: emailSentAt,
    email_error: emailError,
  };

  const baseQuery = idempotencyKey
    ? supabase
        .from("Notifications")
        .upsert(payload, {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        })
    : supabase.from("Notifications").insert(payload);

  const { data: row, error } = await baseQuery
    .select("id,user_id,type,title,body,data,read_at,created_at")
    .single();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to create notification: ${error.message}`);
  }
  return row as NotificationRow | null;
}

export async function listNotifications(userId: string, limit = 30) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("Notifications")
    .select("id,user_id,type,title,body,data,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return (data || []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("Notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw new Error(`Failed to count notifications: ${error.message}`);
  }

  return count ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("Notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (ids?.length) {
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to mark notifications read: ${error.message}`);
  }
}
