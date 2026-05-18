export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Car row fields exposed to clients over the matching WebSocket */
export type CarDetails = {
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string | null;
};

export type DriverState = {
  seats_remaining: number;
  name: string | null;
  picture_url: string | null;
  /** schedule.pickup_loc — where they depart from */
  pickup_loc: string | null;
  /** schedule.dropoff_loc — where they are headed */
  to_location: string | null;
  car: CarDetails | null;
};

export type RiderWaiting = {
  rider_id: string;
  joined_at: number;
  /** Pickup location for this matching session */
  pickup_loc?: string | null;
  /** Destination for this matching session (from rider_request) */
  to_location?: string | null;
};

export type MatchingRoomState = {
  drivers: Map<string, DriverState>;
  riders_waiting: RiderWaiting[];
  pending_matches: Map<string, string>; // rider_id -> driver_id
  connections: Map<string, WebSocket>;
};
