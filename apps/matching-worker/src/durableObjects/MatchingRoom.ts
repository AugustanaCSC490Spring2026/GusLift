import type { Env } from "../db";
import { getSupabase } from "../db";
import { sendMatchPushNotification } from "../pushNotifications";
import {
  parseMatchingSlotKey,
  slotStartTimeToDb,
} from "../slotResolver";
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
const PUSH_DEDUPE_BUCKET_MS = 30 * 1000;
const PUSH_DEDUPE_RETENTION_MS = 2 * 60 * 1000;

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
  residence: string | null;
  picture_url: string | null;
  /** schedule.dropoff_loc */
  to_location: string | null;
  rating: number | null;
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
  private pushDedupes: Map<string, number> = new Map();
  /** Per-rider trip destination from rider_request (survives pending/timeouts) */
  private riderTripDestinations: Map<string, string> = new Map();
  /**
   * riderId -> set of driverIds the rider has rejected.
   * Lives for the DO lifetime so the driver cannot reselect a rider that
   * already turned them down, even after disconnects/reconnects.
   */
  private rejectedDriversByRider: Map<string, Set<string>> = new Map();
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
        // ignore closed9 sockets
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


  private resolveRiderToLocation(
    riderId: string,
    waiting: RiderWaiting | undefined,
    profile: RiderProfile,
  ): string | null {
    const fromWaiting =
      typeof waiting?.to_location === "string" ? waiting.to_location.trim() : "";
    if (fromWaiting) return fromWaiting;
    const fromTrip = this.riderTripDestinations.get(riderId);
    if (fromTrip) return fromTrip;
    return profile.to_location;
  }

  private riderWaitingWire(
    waiting: RiderWaiting,
    profile: RiderProfile,
  ): {
    rider_id: string;
    joined_at: number;
    name: string | null;
    picture_url: string | null;
    to_location: string | null;
    rating: number | null;
  } {
    return {
      rider_id: waiting.rider_id,
      joined_at: waiting.joined_at,
      name: profile.name,
      picture_url: profile.picture_url,
      to_location: this.resolveRiderToLocation(
        waiting.rider_id,
        waiting,
        profile,
      ),
      rating: null,
    };
  }

  private rejectedRidersForDriver(driverId: string): string[] {
    const out: string[] = [];
    for (const [riderId, drivers] of this.rejectedDriversByRider.entries()) {
      if (drivers.has(driverId)) out.push(riderId);
    }
    return out;
  }

  private async fetchAverageRatingForUser(
    userId: string,
  ): Promise<number | null> {
    const supabase = getSupabase(this.env);
    const { data, error } = await supabase
      .from("ratings")
      .select("score")
      .eq("to_user_id", String(userId));
    if (error || !data?.length) return null;
    const sum = (data as { score: number }[]).reduce(
      (s, r) => s + (Number(r.score) || 0),
      0,
    );
    return Math.round((sum / data.length) * 10) / 10;
  }

  private async sendInitialState(userId: string): Promise<void> {
    const riderProfiles = await Promise.all(
      this.riders_waiting.map((r) => this.fetchRiderProfile(r.rider_id)),
    );
    const riders = this.riders_waiting.map((r, idx) =>
      this.riderWaitingWire(r, riderProfiles[idx]!),
    );

    const drivers = Array.from(this.drivers.entries()).map(
      ([driver_id, s]) => ({
        driver_id,
        seats_remaining: s.seats_remaining,
        name: s.name,
        picture_url: s.picture_url,
        to_location: s.to_location,
        car: s.car,
        rating: s.rating,
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
      rejected_by_me: this.rejectedRidersForDriver(userId),
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
          const waiting: RiderWaiting = {
            rider_id: riderId,
            joined_at,
            to_location: this.riderTripDestinations.get(riderId) ?? null,
          };
          this.riders_waiting.push(waiting);
          const profile = await this.fetchRiderProfile(riderId);
          this.broadcast({
            type: "rider_joined",
            rider: this.riderWaitingWire(waiting, profile),
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
    return parseMatchingSlotKey(this.slotKey);
  }

  private shouldSendPush(
    eventType: "driver_selected_rider" | "rider_confirmed_match",
    riderId: string,
    driverId: string,
  ): boolean {
    const now = Date.now();
    const bucket = Math.floor(now / PUSH_DEDUPE_BUCKET_MS);
    const key = `${this.slotKey}:${riderId}:${driverId}:${eventType}:${bucket}`;
    if (this.pushDedupes.has(key)) return false;
    this.pushDedupes.set(key, now);

    const cutoff = now - PUSH_DEDUPE_RETENTION_MS;
    for (const [k, ts] of this.pushDedupes.entries()) {
      if (ts < cutoff) this.pushDedupes.delete(k);
    }
    return true;
  }

  private async insertRide(
    driver_id: string,
    rider_id: string,
    rider_to_location?: string | null,
  ): Promise<RideRow> {
    const { location, start_time } = this.parseSlotKey();
    const dbStartTime = slotStartTimeToDb(start_time);
    const now = new Date();
    const ride_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
    if (riderDrop) { //because rider drop is optional
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
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const schedRows = schedRes.data as { dropoff_loc: string | null }[] | null;
    const to_location = schedRows?.[0]?.dropoff_loc?.trim() || null;

    if (userRes.error || !userRes.data) {
      return {
        id: riderId,
        name: null,
        residence: null,
        picture_url: null,
        to_location,
        rating: null,
      };
    }
    const u = userRes.data as {
      id: string;
      name: string | null;
      residence: string | null;
      picture_url: string | null;
    };
    return { ...u, to_location, rating: null };
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
        .order("created_at", { ascending: false })
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
    const to_location = schedRows?.[0]?.dropoff_loc?.trim() || null;

    const car: CarDetails | null = {
      make: row.make,
      model: row.model,
      color: row.color,
      license_plate: row.license_plate,
    };

    const rating = await this.fetchAverageRatingForUser(driverId);

    return {
      seats_remaining: seats,
      name: user?.name ?? null,
      picture_url: user?.picture_url ?? null,
      to_location,
      car,
      rating,
    };
  }

  private async handleDriverOnline(
    userId: string,
    ev: DriverOnlineEvent,
  ): Promise<void> {
    if (ev.driver_id !== userId) return;
    const state = await this.fetchDriverPublicInfo(ev.driver_id);
    if (!state) return;

    const tripTo =
      typeof ev.to_location === "string" ? ev.to_location.trim() : "";
    if (tripTo) {
      state.to_location = tripTo;
    }

    this.drivers.set(ev.driver_id, state);
    this.broadcast({
      type: "driver_joined",
      driver_id: ev.driver_id,
      seats: state.seats_remaining,
      name: state.name,
      picture_url: state.picture_url,
      to_location: state.to_location,
      car: state.car,
      rating: state.rating,
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
    if (this.pending_matches.has(ev.rider_id)) return;
    if (this.riders_waiting.some((r) => r.rider_id === ev.rider_id)) return;
    const tripTo =
      typeof ev.to_location === "string" ? ev.to_location.trim() : "";
    if (tripTo) {
      this.riderTripDestinations.set(ev.rider_id, tripTo);
    }
    const rider: RiderWaiting = {
      rider_id: ev.rider_id,
      joined_at: Date.now(),
      to_location: tripTo || this.riderTripDestinations.get(ev.rider_id) || null,
    };
    this.riders_waiting.push(rider);
    const profile = await this.fetchRiderProfile(ev.rider_id);
    this.broadcast({
      type: "rider_joined",
      rider: this.riderWaitingWire(rider, profile),
    });
  }

  private handleSelectRider(userId: string, ev: SelectRiderEvent): void {
    if (ev.driver_id !== userId) return;
    const ds = this.drivers.get(ev.driver_id);
    if (!ds) return;
    // Defensive: if the rider already rejected this driver in this room,
    // refuse the reselect even if a stale UI somehow allowed the click.
    const rejectedFor = this.rejectedDriversByRider.get(ev.rider_id);
    if (rejectedFor && rejectedFor.has(ev.driver_id)) return;
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
        rating: ds.rating,
      },
    });
    if (this.shouldSendPush("driver_selected_rider", ev.rider_id, ev.driver_id)) {
      void sendMatchPushNotification(this.env, {
        recipientUserId: ev.rider_id,
        eventType: "driver_selected_rider",
        riderId: ev.rider_id,
        driverId: ev.driver_id,
      });
    }
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
    if (this.shouldSendPush("rider_confirmed_match", ev.rider_id, ev.driver_id)) {
      void sendMatchPushNotification(this.env, {
        recipientUserId: ev.driver_id,
        eventType: "rider_confirmed_match",
        riderId: ev.rider_id,
        driverId: ev.driver_id,
        rideId: ride.id,
      });
    }
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

    let rejectedDrivers = this.rejectedDriversByRider.get(ev.rider_id);
    if (!rejectedDrivers) {
      rejectedDrivers = new Set<string>();
      this.rejectedDriversByRider.set(ev.rider_id, rejectedDrivers);
    }
    rejectedDrivers.add(ev.driver_id);

    const joined_at = Date.now();
    const waiting: RiderWaiting = {
      rider_id: ev.rider_id,
      joined_at,
      to_location: this.riderTripDestinations.get(ev.rider_id) ?? null,
    };
    this.riders_waiting.push(waiting);

    const profile = await this.fetchRiderProfile(ev.rider_id);

    this.broadcast({
      type: "match_rejected",
      rider_id: ev.rider_id,
      driver_id: ev.driver_id,
    });
    this.broadcast({
      type: "rider_joined",
      rider: this.riderWaitingWire(waiting, profile),
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
      this.riderTripDestinations.delete(userId);
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
