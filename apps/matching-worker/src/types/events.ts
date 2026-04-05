/** WebSocket event payloads (client -> DO) */
export type DriverOnlineEvent = {
  type: "driver_online";
  driver_id: string;
};

export type RiderRequestEvent = {
  type: "rider_request";
  rider_id: string;
};

export type SelectRiderEvent = {
  type: "select_rider";
  driver_id: string;
  rider_id: string;
};

export type AcceptMatchEvent = {
  type: "accept_match";
  rider_id: string;
  driver_id: string;
};

/** Rider declines a pending match_request; returns rider to the waiting queue */
export type RejectMatchEvent = {
  type: "reject_match";
  rider_id: string;
  driver_id: string;
};

export type ClientEvent =
  | DriverOnlineEvent
  | RiderRequestEvent
  | SelectRiderEvent
  | AcceptMatchEvent
  | RejectMatchEvent;

/** Shared shape for car info on the wire */
export type CarDetailsWire = {
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string | null;
};

export type RiderWaitingWire = {
  rider_id: string;
  joined_at: number;
  name: string | null;
  picture_url: string | null;
  /** schedule.dropoff_loc */
  to_location: string | null;
};

export type DriverWaitingWire = {
  driver_id: string;
  seats_remaining: number;
  name: string | null;
  picture_url: string | null;
  to_location: string | null;
  car: CarDetailsWire | null;
};

/** Broadcast / server -> client messages */
export type InitialStateMessage = {
  type: "initial_state";
  riders: RiderWaitingWire[];
  drivers: DriverWaitingWire[];
  pending_matches: Array<{ rider_id: string; driver_id: string }>;
};

export type DriverJoinedMessage = {
  type: "driver_joined";
  driver_id: string;
  seats: number;
  name: string | null;
  picture_url: string | null;
  to_location: string | null;
  car: CarDetailsWire | null;
};

export type RiderJoinedMessage = {
  type: "rider_joined";
  rider: RiderWaitingWire;
};

export type RiderReservedMessage = {
  type: "rider_reserved";
  rider_id: string;
  driver_id: string;
};

export type MatchRejectedMessage = {
  type: "match_rejected";
  rider_id: string;
  driver_id: string;
};

export type MatchRequestMessage = {
  type: "match_request";
  driver_id: string;
  rider_id: string;
  driver: {
    name: string | null;
    picture_url: string | null;
    to_location: string | null;
    car: CarDetailsWire | null;
  };
};

export type RiderRemovedMessage = {
  type: "rider_removed";
  rider_id: string;
};

export type SeatUpdateMessage = {
  type: "seat_update";
  driver_id: string;
  seats_remaining: number;
};

export type MatchConfirmedMessage = {
  type: "match_confirmed";
  ride: {
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
  rider: {
    id: string;
    name: string | null;
    residence: string | null;
    picture_url: string | null;
    to_location: string | null;
  };
};

export type ServerMessage =
  | InitialStateMessage
  | DriverJoinedMessage
  | RiderJoinedMessage
  | RiderReservedMessage
  | MatchRejectedMessage
  | MatchRequestMessage
  | RiderRemovedMessage
  | SeatUpdateMessage
  | MatchConfirmedMessage;
