import { getSupabase, type Env } from "./db";

type PushEventType = "driver_selected_rider" | "rider_confirmed_match";

type PushSendParams = {
  recipientUserId: string;
  eventType: PushEventType;
  riderId: string;
  driverId: string;
  rideId?: string;
};

type PushTokenRow = {
  token: string;
};

type ExpoTicket = {
  status?: string;
  details?: {
    error?: string;
  };
};

function buildPushContent(eventType: PushEventType) {
  if (eventType === "driver_selected_rider") {
    return {
      title: "Driver found",
      body: "A driver accepted your ride request.",
    };
  }
  return {
    title: "Rider confirmed",
    body: "A rider confirmed your ride offer.",
  };
}

async function deactivateTokens(env: Env, tokens: string[]): Promise<void> {
  const uniq = Array.from(new Set(tokens.filter(Boolean)));
  if (uniq.length === 0) return;
  const supabase = getSupabase(env);
  const { error } = await supabase
    .from("PushTokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("token", uniq);
  if (error) {
    console.error("[push] Failed to deactivate tokens:", error.message);
  }
}

export async function sendMatchPushNotification(
  env: Env,
  params: PushSendParams,
): Promise<void> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from("PushTokens")
    .select("token")
    .eq("user_id", params.recipientUserId)
    .eq("is_active", true);
  if (error) {
    console.error(
      `[push] token lookup failed for user ${params.recipientUserId}:`,
      error.message,
    );
    return;
  }

  const tokens = Array.from(
    new Set(
      ((data || []) as PushTokenRow[])
        .map((row) => (typeof row.token === "string" ? row.token.trim() : ""))
        .filter(Boolean),
    ),
  );
  if (tokens.length === 0) return;

  const content = buildPushContent(params.eventType);
  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: content.title,
    body: content.body,
    data: {
      type: params.eventType,
      rider_id: params.riderId,
      driver_id: params.driverId,
      ...(params.rideId ? { ride_id: params.rideId } : {}),
    },
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        `[push] expo send failed (${response.status}) for user ${params.recipientUserId}`,
      );
      return;
    }

    const json = (await response.json()) as { data?: ExpoTicket[] };
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const invalidTokens: string[] = [];

    tickets.forEach((ticket, idx) => {
      if (
        ticket?.status === "error" &&
        ticket?.details?.error === "DeviceNotRegistered"
      ) {
        invalidTokens.push(tokens[idx] || "");
      }
    });

    if (invalidTokens.length > 0) {
      await deactivateTokens(env, invalidTokens);
    }
  } catch (err) {
    console.error(
      `[push] send exception for user ${params.recipientUserId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
