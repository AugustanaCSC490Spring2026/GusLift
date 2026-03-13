import type { Env } from "../db";
import type {
  ClientEvent,
  ServerMessage,
  DriverOnlineEvent,
  RiderRequestEvent,
  SelectRiderEvent,
  AcceptMatchEvent,
} from "../types/events";
import type { DriverState, RiderWaiting } from "../types/state";
import { getSupabase } from "../db";

const MATCH_TIMEOUT_MS = 30_000;

type RideRow = {
  id: string;
  driver_id: string;
  rider_id: string;
  day: string;
  start_time: string;
  location: string;
  status: string;
  completed: boolean;
  created_at?: string;
};

type RiderProfile = {
  id: string;
  name: string | null;
  residence: string | null;
  picture_url: string | null;
};

type CarRow = {
  capacity: number | null;
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

  private sendInitialState(userId: string): void {
    const riders = this.riders_waiting.map((r) => ({
      rider_id: r.rider_id,
      joined_at: r.joined_at,
    }));
    const drivers = Array.from(this.drivers.entries()).map(([driver_id, s]) => ({
      driver_id,
      seats_remaining: s.seats_remaining,
    }));
    const pending_matches = Array.from(this.pending_matches.entries()).map(
      ([rider_id, driver_id]) => ({ rider_id, driver_id })
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
      this.matchTimeouts.delete(riderId);
      const driverId = this.pending_matches.get(riderId);
      if (driverId != null) {
        this.pending_matches.delete(riderId);
        this.riders_waiting.push({
          rider_id: riderId,
          joined_at: Date.now(),
        });
        this.broadcast({
          type: "rider_joined",
          rider: { rider_id: riderId, joined_at: Date.now() },
        });
      }
    }, MATCH_TIMEOUT_MS);
    this.matchTimeouts.set(riderId, id);
  }

  private parseSlotKey(): { location: string; day: string; start_time: string } {
    const parts = this.slotKey.split(":");
    return {
      location: parts[0] ?? "",
      day: parts[1] ?? "",
      start_time: parts[2] ?? "",
    };
  }

  private async insertRide(
    driver_id: string,
    rider_id: string
  ): Promise<RideRow> {
    const { location, day, start_time } = this.parseSlotKey();
    const supabase = getSupabase(this.env);
    const { data, error } = await supabase
      .from("rides")
      .insert({
        driver_id,
        rider_id,
        day,
        start_time,
        location,
        status: "accepted",
        completed: false,
      })
      .select("id,driver_id,rider_id,day,start_time,location,status,completed,created_at")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to insert accepted ride");
    }
    return data as RideRow;
  }

  private async fetchRiderProfile(riderId: string): Promise<RiderProfile> {
    const supabase = getSupabase(this.env);
    const { data, error } = await supabase
      .from("User")
      .select("id,name,residence,picture_url")
      .eq("id", riderId)
      .single();

    if (error || !data) {
      return {
        id: riderId,
        name: null,
        residence: null,
        picture_url: null,
      };
    }
    return data as RiderProfile;
  }

  private async fetchDriverCapacity(driverId: string): Promise<number | null> {
    const supabase = getSupabase(this.env);
    const { data, error } = await supabase
      .from("Car")
      .select("capacity")
      .eq("user_id", driverId)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as CarRow;
    if (typeof row.capacity !== "number" || row.capacity <= 0) {
      return null;
    }
    return row.capacity;
  }

  private async handleDriverOnline(userId: string, ev: DriverOnlineEvent): Promise<void> {
    if (ev.driver_id !== userId) return;
    const seats = await this.fetchDriverCapacity(ev.driver_id);
    if (!seats) return;

    this.drivers.set(ev.driver_id, { seats_remaining: seats });
    this.broadcast({
      type: "driver_joined",
      driver_id: ev.driver_id,
      seats,
    });
  }

  private handleRiderRequest(userId: string, ev: RiderRequestEvent): void {
    if (ev.rider_id !== userId) return;
    const rider: RiderWaiting = { rider_id: ev.rider_id, joined_at: Date.now() };
    this.riders_waiting.push(rider);
    this.broadcast({ type: "rider_joined", rider });
  }

  private handleSelectRider(userId: string, ev: SelectRiderEvent): void {
    if (ev.driver_id !== userId) return;
    const idx = this.riders_waiting.findIndex((r) => r.rider_id === ev.rider_id);
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
    });
    this.scheduleMatchTimeout(ev.rider_id);
  }

  private async handleAcceptMatch(userId: string, ev: AcceptMatchEvent): Promise<void> {
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

    const ride = await this.insertRide(ev.driver_id, ev.rider_id);
    const rider = await this.fetchRiderProfile(ev.rider_id);

    this.sendTo(ev.driver_id, {
      type: "match_confirmed",
      ride,
      rider,
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
        this.handleRiderRequest(userId, ev);
        break;
      case "select_rider":
        this.handleSelectRider(userId, ev);
        break;
      case "accept_match":
        await this.handleAcceptMatch(userId, ev);
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
      this.riders_waiting = this.riders_waiting.filter((r) => r.rider_id !== userId);
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

    this.sendInitialState(userId);
    this.handleConnection(server, userId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
