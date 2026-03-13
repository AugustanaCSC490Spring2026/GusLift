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

export type ClientEvent =
  | DriverOnlineEvent
  | RiderRequestEvent
  | SelectRiderEvent
  | AcceptMatchEvent;

/** Broadcast / server -> client messages */
export type InitialStateMessage = {
  type: "initial_state";
  riders: Array<{ rider_id: string; joined_at: number }>;
  drivers: Array<{ driver_id: string; seats_remaining: number }>;
  pending_matches: Array<{ rider_id: string; driver_id: string }>;
};

export type DriverJoinedMessage = {
  type: "driver_joined";
  driver_id: string;
  seats: number;
};

export type RiderJoinedMessage = {
  type: "rider_joined";
  rider: { rider_id: string; joined_at: number };
};

export type RiderReservedMessage = {
  type: "rider_reserved";
  rider_id: string;
  driver_id: string;
};

export type MatchRequestMessage = {
  type: "match_request";
  driver_id: string;
  rider_id: string;
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
  };
};

export type ServerMessage =
  | InitialStateMessage
  | DriverJoinedMessage
  | RiderJoinedMessage
  | RiderReservedMessage
  | MatchRequestMessage
  | RiderRemovedMessage
  | SeatUpdateMessage
  | MatchConfirmedMessage;
