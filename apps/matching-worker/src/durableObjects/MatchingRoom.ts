import type { Env } from "../db";
import { getSupabase } from "../db";
import type {
  AcceptMatchEvent,
  ClientEvent,
  DriverOnlineEvent,
  RejectMatchEvent,
  RiderRequestEvent,
  SelectRiderEvent,
  ServerMessage,
} from "../types/events";
import type { CarDetails, DriverState, RiderWaiting } from "../types/state";

// How long a driver has to confirm a match before the rider is returned
// to the waiting queue. Increased to 4 minutes for demo stability.
const MATCH_TIMEOUT_MS = 4 * 60 * 1000; // 240_000 ms

type RideRow = {
  id: string;
  driver_id: string;
  rider_id: string;
  day: string;
  ride_date: string;
  start_time: string;
  location: string;
  rider_dropoff_loc?: string | null;
  status: string;
  completed: boolean;
  created_at?: string;
};

type RiderProfile = {
  id: string;
  name: string | null;
  email: string | null;
  residence: string | null;
  picture_url: string | null;
  /** schedule.dropoff_loc */
  to_location: string | null;
};

type UserContact = {
  name: string | null;
  email: string | null;
};

type CarRow = {
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string | null;
  capacity: number | null;
  created_at?: string | null;
};

export class MatchingRoom implements DurableObject {
  private drivers: Map<string, DriverState> = new Map();
  private riders_waiting: RiderWaiting[] = [];
  private pending_matches: Map<string, string> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private matchTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private slotKey: string = "";
  private env: Env;

  constructor(_ctx: DurableObjectState, env: Env) {
    this.env = env;
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const ws of this.connections.values()) {
      try {
        ws.send(payload);
      } catch (_) {
        // ignore closed sockets
      }
    }
  }

  private sendTo(userId: string, message: ServerMessage): void {
    const ws = this.connections.get(userId);
    if (ws) {
      try {
        ws.send(JSON.stringify(message));
      } catch (_) {}
    }
  }

  private async sendInitialState(userId: string): Promise<void> {
    const riderProfiles = await Promise.all(
      this.riders_waiting.map((r) => this.fetchRiderProfile(r.rider_id)),
    );
    const riders = this.riders_waiting.map((r, idx) => {
      const profile = riderProfiles[idx];
      return {
        rider_id: r.rider_id,
        joined_at: r.joined_at,
        name: profile?.name ?? null,
        picture_url: profile?.picture_url ?? null,
        to_location: profile?.to_location ?? null,
      };
    });
    const drivers = Array.from(this.drivers.entries()).map(
      ([driver_id, s]) => ({
        driver_id,
        seats_remaining: s.seats_remaining,
        name: s.name,
        picture_url: s.picture_url,
        to_location: s.to_location,
        car: s.car,
      }),
    );
    const pending_matches = Array.from(this.pending_matches.entries()).map(
      ([rider_id, driver_id]) => ({ rider_id, driver_id }),
    );
    this.sendTo(userId, {
      type: "initial_state",
      riders,
      drivers,
      pending_matches,
    });
  }

  private clearMatchTimeout(riderId: string): void {
    const t = this.matchTimeouts.get(riderId);
    if (t) {
      clearTimeout(t);
      this.matchTimeouts.delete(riderId);
    }
  }

  private scheduleMatchTimeout(riderId: string): void {
    this.clearMatchTimeout(riderId);
    const id = setTimeout(() => {
      void (async () => {
        this.matchTimeouts.delete(riderId);
        const driverId = this.pending_matches.get(riderId);
        if (driverId != null) {
          this.pending_matches.delete(riderId);
          const joined_at = Date.now();
          this.riders_waiting.push({
            rider_id: riderId,
            joined_at,
          });
          const profile = await this.fetchRiderProfile(riderId);
          void this.createNotification({
            userId: riderId,
            type: "match_expired",
            title: "Match expired",
            body: "The driver did not confirm in time, so you are back in the rider queue.",
            data: {
              driver_id: driverId,
              slot_key: this.slotKey,
            },
            idempotencyKey: `match:${this.slotKey}:${driverId}:${riderId}:expired`,
          });
          void this.createNotification({
            userId: driverId,
            type: "match_expired",
            title: "Match expired",
            body: `${profile.name || "A rider"} is back in the queue after the match timed out.`,
            data: {
              rider_id: riderId,
              slot_key: this.slotKey,
            },
            idempotencyKey: `match:${this.slotKey}:${driverId}:${riderId}:expired:driver`,
          });
          this.broadcast({
            type: "rider_joined",
            rider: {
              rider_id: riderId,
              joined_at,
              name: profile.name,
              picture_url: profile.picture_url,
              to_location: profile.to_location,
            },
          });
        }
      })();
    }, MATCH_TIMEOUT_MS);
    this.matchTimeouts.set(riderId, id);
  }

  private parseSlotKey(): {
    location: string;
    day: string;
    start_time: string;
  } {
    const parts = this.slotKey.split(":");
    return {
      location: parts[0] ?? "",
      day: parts[1] ?? "",
      start_time: parts[2] ?? "",
    };
  }

  private async insertRide(
    driver_id: string,
    rider_id: string,
    rider_to_location?: string | null,
  ): Promise<RideRow> {
    const { location, start_time } = this.parseSlotKey();
    // Normalize start_time to a valid Postgres time value.
    // Our slot key sometimes stores just "HH" (e.g. "09"); Postgres `time`
    // expects at least "HH:MM", so default missing minutes to ":00".
    const dbStartTime =
      start_time && !start_time.includes(":") ? `${start_time}:00` : start_time;
    // Map the slot into a concrete date for ride_date. For now, use "today" in UTC.
    const ride_date = new Date().toISOString().slice(0, 10);
    const riderDrop =
      typeof rider_to_location === "string" ? rider_to_location.trim() : "";
    const supabase = getSupabase(this.env);
    const insertRow: Record<string, unknown> = {
      driver_id,
      rider_id,
      ride_date,
      start_time: dbStartTime,
      location,
      status: "accepted",
    };
    if (riderDrop) {
      insertRow.rider_dropoff_loc = riderDrop;
    }
    const { data, error } = await supabase
      .from("Rides")
      .insert(insertRow)
      .select(
        "id,driver_id,rider_id,ride_date,start_time,location,rider_dropoff_loc,status,created_at",
      )
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to insert accepted ride");
    }
    return data as RideRow;
  }

  private async createNotification({
    userId,
    type,
    title,
    body,
    data = {},
    idempotencyKey,
    sendEmail = false,
  }: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    idempotencyKey?: string;
    sendEmail?: boolean;
  }): Promise<void> {
    try {
      const supabase = getSupabase(this.env);
      let emailTo: string | null = null;
      let emailStatus: string | null = null;
      let emailSentAt: string | null = null;
      let emailError: string | null = null;

      if (sendEmail) {
        emailTo = await this.fetchUserEmail(userId);
        if (!emailTo) {
          emailStatus = "skipped";
          emailError = "User email is missing";
        } else {
          const result = await this.sendEmail({
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
        idempotency_key: idempotencyKey ?? null,
        email_to: emailTo,
        email_status: emailStatus,
        email_sent_at: emailSentAt,
        email_error: emailError,
      };
      if (idempotencyKey) {
        await supabase
          .from("Notifications")
          .upsert(payload, {
            onConflict: "idempotency_key",
            ignoreDuplicates: true,
          });
      } else {
        await supabase.from("Notifications").insert(payload);
      }
    } catch (_) {
      // Matching should not fail just because a notification could not be written.
    }
  }

  private async fetchUserEmail(userId: string): Promise<string | null> {
    const supabase = getSupabase(this.env);
    const { data } = await supabase
      .from("User")
      .select("email")
      .eq("id", userId)
      .single();
    const email = (data as { email?: string | null } | null)?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  }

  private async fetchUserContact(userId: string): Promise<UserContact> {
    const supabase = getSupabase(this.env);
    const { data } = await supabase
      .from("User")
      .select("name,email")
      .eq("id", userId)
      .single();
    const row = data as UserContact | null;
    return {
      name: row?.name ?? null,
      email: row?.email ?? null,
    };
  }

  private async sendEmail({
    to,
    subject,
    text,
  }: {
    to: string;
    subject: string;
    text: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const apiKey = this.env.RESEND_API_KEY;
    const from = this.env.EMAIL_FROM || this.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return {
        ok: false,
        error: "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          error:
            typeof payload?.message === "string"
              ? payload.message
              : `Email provider returned ${response.status}`,
        };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Email request failed",
      };
    }
  }

  private async fetchRiderProfile(riderId: string): Promise<RiderProfile> {
    const supabase = getSupabase(this.env);
    const [userRes, schedRes] = await Promise.all([
      supabase
        .from("User")
        .select("id,name,residence,picture_url")
        .eq("id", riderId)
        .single(),
      supabase
        .from("schedule")
        .select("dropoff_loc")
        .eq("user_id", riderId)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    const schedRows = schedRes.data as { dropoff_loc: string | null }[] | null;
    const to_location = schedRows?.[0]?.dropoff_loc ?? null;

    if (userRes.error || !userRes.data) {
      return {
        id: riderId,
        name: null,
        residence: null,
        email: null,
        picture_url: null,
        to_location,
      };
    }
    const u = userRes.data as {
      id: string;
      name: string | null;
      email: string | null;
      residence: string | null;
      picture_url: string | null;
    };
    return { ...u, to_location };
  }

  /**
   * Loads driver User + Car + schedule dropoff for WebSocket payloads.
   * Returns null if the driver has no car or invalid seat capacity.
   */
  private async fetchDriverPublicInfo(
    driverId: string,
  ): Promise<DriverState | null> {
    const supabase = getSupabase(this.env);
    const [userRes, carRes, schedRes] = await Promise.all([
      supabase
        .from("User")
        .select("name,picture_url")
        .eq("id", driverId)
        .single(),
      supabase
        .from("Car")
        .select("make,model,color,license_plate,capacity,created_at")
        .eq("user_id", driverId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("schedule")
        .select("dropoff_loc")
        .eq("user_id", driverId)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    const carRows = carRes.data as CarRow[] | null;
    const row = carRows?.[0];
    const cap = row?.capacity;
    const seats =
      typeof cap === "number" && cap > 0
        ? cap
        : typeof cap === "string"
          ? Number(cap)
          : NaN;
    if (!row || !Number.isFinite(seats) || seats <= 0) {
      return null;
    }

    const user = userRes.data as {
      name: string | null;
      picture_url: string | null;
    } | null;
    const schedRows = schedRes.data as { dropoff_loc: string | null }[] | null;
    const to_location = schedRows?.[0]?.dropoff_loc ?? null;

    const car: CarDetails | null = {
      make: row.make,
      model: row.model,
      color: row.color,
      license_plate: row.license_plate,
    };

    return {
      seats_remaining: seats,
      name: user?.name ?? null,
      picture_url: user?.picture_url ?? null,
      to_location,
      car,
    };
  }

  private async handleDriverOnline(
    userId: string,
    ev: DriverOnlineEvent,
  ): Promise<void> {
    if (ev.driver_id !== userId) return;
    const state = await this.fetchDriverPublicInfo(ev.driver_id);
    if (!state) return;

    this.drivers.set(ev.driver_id, state);
    this.broadcast({
      type: "driver_joined",
      driver_id: ev.driver_id,
      seats: state.seats_remaining,
      name: state.name,
      picture_url: state.picture_url,
      to_location: state.to_location,
      car: state.car,
    });
    // initial_state on websocket open is often delivered before the app registers
    // any MatchingContext listeners, so it is dropped. Re-send after driver_online
    // when the client is listening.
    await this.sendInitialState(userId);
  }

  private async handleRiderRequest(
    userId: string,
    ev: RiderRequestEvent,
  ): Promise<void> {
    if (ev.rider_id !== userId) return;
    const rider: RiderWaiting = {
      rider_id: ev.rider_id,
      joined_at: Date.now(),
    };
    this.riders_waiting.push(rider);
    const profile = await this.fetchRiderProfile(ev.rider_id);
    void this.createNotification({
      userId: ev.rider_id,
      type: "ride_requested",
      title: "Ride request received",
      body: "You are in the rider queue. We will let you know when a driver matches with you.",
      data: {
        slot_key: this.slotKey,
      },
      idempotencyKey: `request:${this.slotKey}:${ev.rider_id}:${rider.joined_at}`,
      sendEmail: true,
    });
    for (const driverId of this.drivers.keys()) {
      void this.createNotification({
        userId: driverId,
        type: "rider_waiting",
        title: "New rider request",
        body: `${profile.name || "A rider"} is waiting for a ride in your current slot.`,
        data: {
          rider_id: ev.rider_id,
          slot_key: this.slotKey,
        },
        idempotencyKey: `request:${this.slotKey}:${ev.rider_id}:${driverId}:${rider.joined_at}`,
        sendEmail: true,
      });
    }
    this.broadcast({
      type: "rider_joined",
      rider: {
        rider_id: rider.rider_id,
        joined_at: rider.joined_at,
        name: profile.name,
        picture_url: profile.picture_url,
        to_location: profile.to_location,
      },
    });
  }

  private handleSelectRider(userId: string, ev: SelectRiderEvent): void {
    if (ev.driver_id !== userId) return;
    const ds = this.drivers.get(ev.driver_id);
    if (!ds) return;
    const idx = this.riders_waiting.findIndex(
      (r) => r.rider_id === ev.rider_id,
    );
    if (idx === -1) return;
    this.riders_waiting.splice(idx, 1);
    this.pending_matches.set(ev.rider_id, ev.driver_id);
    this.broadcast({
      type: "rider_reserved",
      rider_id: ev.rider_id,
      driver_id: ev.driver_id,
    });
    this.sendTo(ev.rider_id, {
      type: "match_request",
      driver_id: ev.driver_id,
      rider_id: ev.rider_id,
      driver: {
        name: ds.name,
        picture_url: ds.picture_url,
        to_location: ds.to_location,
        car: ds.car,
      },
    });
    void this.createNotification({
      userId: ev.rider_id,
      type: "match_selected",
      title: "Driver found",
      body: "A driver selected your ride request. Review and confirm to continue.",
      data: {
        driver_id: ev.driver_id,
        slot_key: this.slotKey,
      },
      idempotencyKey: `match:${this.slotKey}:${ev.driver_id}:${ev.rider_id}:selected`,
      sendEmail: true,
    });
    this.scheduleMatchTimeout(ev.rider_id);
  }

  private async handleAcceptMatch(
    userId: string,
    ev: AcceptMatchEvent,
  ): Promise<void> {
    if (ev.rider_id !== userId) return;
    const driverId = this.pending_matches.get(ev.rider_id);
    if (driverId !== ev.driver_id) return;
    this.pending_matches.delete(ev.rider_id);
    this.clearMatchTimeout(ev.rider_id);

    const driver = this.drivers.get(ev.driver_id);
    if (!driver) return;
    driver.seats_remaining -= 1;
    if (driver.seats_remaining <= 0) {
      this.drivers.delete(ev.driver_id);
    }

    this.broadcast({ type: "rider_removed", rider_id: ev.rider_id });
    this.broadcast({
      type: "seat_update",
      driver_id: ev.driver_id,
      seats_remaining: driver.seats_remaining,
    });

    const rider = await this.fetchRiderProfile(ev.rider_id);
    const ride = await this.insertRide(ev.driver_id, ev.rider_id, ev.rider_to_location);
    const driverContact = await this.fetchUserContact(ev.driver_id);

    void this.createNotification({
      userId: ev.driver_id,
      type: "match_accepted",
      title: "Ride accepted",
      body: `${rider.name || "A rider"} accepted your match.`,
      data: {
        ride_id: ride.id,
        rider_id: ev.rider_id,
        slot_key: this.slotKey,
      },
      idempotencyKey: `match:${this.slotKey}:${ev.driver_id}:${ev.rider_id}:accepted`,
      sendEmail: true,
    });
    void this.createNotification({
      userId: ev.rider_id,
      type: "ride_created",
      title: "Ride created",
      body: `Your ride with ${driverContact.name || "your driver"} has been added to your upcoming rides.`,
      data: {
        ride_id: ride.id,
        driver_id: ev.driver_id,
        slot_key: this.slotKey,
      },
      idempotencyKey: `ride:${ride.id}:created:rider`,
      sendEmail: true,
    });

    this.sendTo(ev.driver_id, {
      type: "match_confirmed",
      ride,
      rider: {
        id: rider.id,
        name: rider.name,
        residence: rider.residence,
        picture_url: rider.picture_url,
        to_location: rider.to_location,
      },
    });
  }

  private async handleRejectMatch(
    userId: string,
    ev: RejectMatchEvent,
  ): Promise<void> {
    if (ev.rider_id !== userId) return;
    const driverId = this.pending_matches.get(ev.rider_id);
    if (driverId !== ev.driver_id) return;

    this.pending_matches.delete(ev.rider_id);
    this.clearMatchTimeout(ev.rider_id);

    const joined_at = Date.now();
    this.riders_waiting.push({
      rider_id: ev.rider_id,
      joined_at,
    });

    const profile = await this.fetchRiderProfile(ev.rider_id);

    this.broadcast({
      type: "match_rejected",
      rider_id: ev.rider_id,
      driver_id: ev.driver_id,
    });
    void this.createNotification({
      userId: ev.driver_id,
      type: "match_rejected",
      title: "Match rejected",
      body: `${profile.name || "A rider"} passed on your match. They are back in the queue.`,
      data: {
        rider_id: ev.rider_id,
        slot_key: this.slotKey,
      },
      idempotencyKey: `match:${this.slotKey}:${ev.driver_id}:${ev.rider_id}:rejected`,
    });
    this.broadcast({
      type: "rider_joined",
      rider: {
        rider_id: ev.rider_id,
        joined_at,
        name: profile.name,
        picture_url: profile.picture_url,
        to_location: profile.to_location,
      },
    });
  }

  private async handleMessage(userId: string, raw: string): Promise<void> {
    let ev: ClientEvent;
    try {
      ev = JSON.parse(raw) as ClientEvent;
    } catch {
      return;
    }
    switch (ev.type) {
      case "driver_online":
        await this.handleDriverOnline(userId, ev);
        break;
      case "rider_request":
        await this.handleRiderRequest(userId, ev);
        break;
      case "select_rider":
        this.handleSelectRider(userId, ev);
        break;
      case "accept_match":
        await this.handleAcceptMatch(userId, ev);
        break;
      case "reject_match":
        await this.handleRejectMatch(userId, ev);
        break;
    }
  }

  private handleConnection(ws: WebSocket, userId: string): void {
    this.connections.set(userId, ws);

    ws.addEventListener("message", (event) => {
      const data = event.data;
      if (typeof data === "string") {
        void this.handleMessage(userId, data);
      }
    });

    ws.addEventListener("close", () => {
      this.connections.delete(userId);
      this.drivers.delete(userId);
      this.riders_waiting = this.riders_waiting.filter(
        (r) => r.rider_id !== userId,
      );
      this.pending_matches.delete(userId);
      this.clearMatchTimeout(userId);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const userId = request.headers.get("X-User-Id")?.trim();
    const slotKey = request.headers.get("X-Slot-Key")?.trim();
    if (!userId) {
      return new Response("Missing X-User-Id", { status: 401 });
    }
    if (slotKey) {
      this.slotKey = slotKey;
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    this.handleConnection(server, userId);
    await this.sendInitialState(userId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
