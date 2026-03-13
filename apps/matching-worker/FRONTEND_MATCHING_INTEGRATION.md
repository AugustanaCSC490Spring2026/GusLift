# Frontend Integration Contract - Matching Service

This document describes exactly what the frontend must implement to connect to the matching service, what payloads to send, and what to expect back.

## 1) Endpoint and transport

- Transport: WebSocket
- Connect to: `wss://<matching-worker-domain>`
- Backend routing is done server-side by slot (`location:day:start_time`) in Durable Objects.

The frontend should treat this as one persistent real-time channel:
- open once for matching screen/session
- send JSON messages for actions
- handle JSON messages for updates

---

## 2) Authentication requirements

Frontend must provide a Supabase access token on connect:

- Preferred for browsers/mobile: query param
  - `?token=<supabase_access_token>`
- Alternative: `Authorization: Bearer <token>` header (only if client environment supports WebSocket custom headers)

Example:

`wss://<matching-worker-domain>?token=<jwt>`

### Rider override for no-schedule users

If a rider has no schedule row (or no schedule for current day), pass:

- `location` (required with override)
- `time` (required with override, `HH:MM` 24h)
- `day` (optional: `mon|tue|wed|thu|fri|sat|sun`, defaults to current UTC day)

Example:

`wss://<matching-worker-domain>?token=<jwt>&location=Augie&time=08:00&day=mon`

---

## 3) Connection lifecycle expected from frontend

1. Open socket.
2. Wait for `open`.
3. Start listening to server messages immediately.
4. Receive `initial_state` first (current room snapshot).
5. Send user actions as JSON messages (see section 4).
6. Handle close/reconnect behavior in app code (recommended exponential backoff).

---

## 4) Client -> server messages (frontend sends)

All messages must be JSON strings via `ws.send(JSON.stringify(payload))`.

## Driver messages

### `driver_online`
```json
{
  "type": "driver_online",
  "driver_id": "<authenticated_user_id>"
}
```

Seat count is not sent by frontend. Backend loads seats from `Car.capacity` for that driver.

### `select_rider`
```json
{
  "type": "select_rider",
  "driver_id": "<authenticated_user_id>",
  "rider_id": "<rider_user_id>"
}
```

## Rider messages

### `rider_request`
```json
{
  "type": "rider_request",
  "rider_id": "<authenticated_user_id>"
}
```

### `accept_match`
```json
{
  "type": "accept_match",
  "rider_id": "<authenticated_user_id>",
  "driver_id": "<driver_user_id>"
}
```

### Important identity rule

`driver_id` / `rider_id` in payload must match the authenticated websocket user.
Messages that do not match authenticated identity are ignored.

---

## 5) Server -> client messages (frontend receives)

### `initial_state`
Sent on connection to hydrate UI state.

```json
{
  "type": "initial_state",
  "riders": [{ "rider_id": "r1", "joined_at": 1710000000000 }],
  "drivers": [{ "driver_id": "d1", "seats_remaining": 3 }],
  "pending_matches": [{ "rider_id": "r1", "driver_id": "d1" }]
}
```

### `rider_joined`
```json
{
  "type": "rider_joined",
  "rider": { "rider_id": "r1", "joined_at": 1710000000000 }
}
```

### `rider_reserved`
```json
{
  "type": "rider_reserved",
  "rider_id": "r1",
  "driver_id": "d1"
}
```

### `match_request` (to rider)
```json
{
  "type": "match_request",
  "driver_id": "d1",
  "rider_id": "r1"
}
```

### `rider_removed`
```json
{
  "type": "rider_removed",
  "rider_id": "r1"
}
```

### `seat_update`
```json
{
  "type": "seat_update",
  "driver_id": "d1",
  "seats_remaining": 2
}
```

### `match_confirmed` (to selected driver)
Sent after rider accepts and ride is inserted into DB.

```json
{
  "type": "match_confirmed",
  "ride": {
    "id": "ride-id",
    "driver_id": "d1",
    "rider_id": "r1",
    "day": "mon",
    "start_time": "08:00",
    "location": "AUGIE",
    "status": "accepted",
    "completed": false,
    "created_at": "2026-03-10T10:00:00.000Z"
  },
  "rider": {
    "id": "r1",
    "name": "Jane Rider",
    "residence": "Downtown",
    "picture_url": "https://..."
  }
}
```

---

## 6) Driver page data strategy (recommended) -> the page for the list of accepted rides for the driver.

Use both:

- REST API for durable source of truth on page load:
  - `GET /api/driver/rides?driver_id=<driver_user_id>`
  - returns accepted rides only (`status = "accepted"`)
- WebSocket for live updates:
  - consume `match_confirmed` and merge into local list immediately

This avoids missing rides when app was offline/restarted.

---

## 7) Frontend responsibilities checklist

- Keep access token available before opening socket.
- Open websocket to matching worker endpoint.
- Parse and route messages by `type`.
- Enforce role-based UI behavior:
  - drivers send `driver_online` / `select_rider`
  - riders send `rider_request` / `accept_match`
- Merge `initial_state` first, then apply incremental events.
- Handle reconnect and rehydrate from `/api/driver/rides` when needed.

---

## 8) Backend responsibilities checklist

- Authenticate token and derive user id.
- Resolve slot from schedule (or rider override params).
- Route socket to slot-specific Durable Object.
- Validate event ownership (`payload user id` must equal authenticated user id).
- Persist accepted rides in database.
- Emit `match_confirmed` to driver on successful acceptance.

---

## 9) Known current behavior notes

- Weekday resolution currently uses UTC day.
- Token handling currently decodes JWT payload to read `sub`.
