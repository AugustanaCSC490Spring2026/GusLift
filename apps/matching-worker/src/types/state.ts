export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DriverState = {
  seats_remaining: number;
};

export type RiderWaiting = {
  rider_id: string;
  joined_at: number;
};

export type MatchingRoomState = {
  drivers: Map<string, DriverState>;
  riders_waiting: RiderWaiting[];
  pending_matches: Map<string, string>; // rider_id -> driver_id
  connections: Map<string, WebSocket>;
};
