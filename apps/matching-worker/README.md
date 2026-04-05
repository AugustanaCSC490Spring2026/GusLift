# GusLift Matching Worker

Cloudflare Worker + Durable Object for real-time driver–rider matching. Clients join a room keyed by **`location:day:start_time`** (for example `AUGIE:mon:08:00`).

## Setup

1. Install: `npm install`
2. Copy `.dev.vars.example` to `.dev.vars` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. For production, set secrets:
   - `wrangler secret put SUPABASE_URL`
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`

## Dev

- `npm run dev` — local Worker + DO (requires `.dev.vars`).

## Deploy

- `npm run deploy` — deploys to Cloudflare (set secrets first).

## Auth

Send the current user id in either:

- `Authorization: Bearer <user_id>`, or
- Query `?token=<user_id>`

The worker loads **User** (residence) and **schedule** (`days` JSON) from Supabase to resolve the default slot for the current UTC weekday.

## Slot resolution

- **Default**: `User.residence` → normalized location + today’s weekday + **start time from `schedule.days[today]`**.
- **No class block for today**: the resolver signals **manual time required** instead of a generic 400-only failure. Clients should collect **pickup location + `HH:MM` time** (and optionally `day`) and retry with overrides (see below).
- **Overrides** (one-off / manual rides): same query params as the WebSocket URL:
  - `location` — required together with `time` when overriding
  - `time` — `HH:MM` (24h)
  - `day` — optional: `mon|tue|wed|thu|fri|sat|sun` (defaults to current UTC weekday)

## HTTP preflight (GET)

Before opening a WebSocket, clients should **`GET`** the same URL they would use for the socket **without** the `Upgrade: websocket` header. The worker returns JSON:

| Response | Meaning |
|----------|---------|
| `{ ok: true, slot }` | Slot resolved; safe to open WebSocket with identical query string |
| `{ ok: false, needsManualTime: true, message }` | No schedule for today (or equivalent); user must supply `location` + `time` (and optionally `day`) |
| `{ ok: false, error }` (400) | Invalid override (e.g. bad time format, partial override) |
| `{ error }` (401) | Missing/invalid auth |

If a client opens a WebSocket **without** manual params when they are required, the upgrade may fail with **422** and a JSON body containing `needsManualTime` (preflight avoids this).

## WebSocket URL

Example (manual slot):

`wss://<worker-domain>?token=<user_id>&location=Augie&time=16:30`

The Durable Object receives `X-User-Id` and `X-Slot-Key` from the worker after slot resolution.

## WebSocket events (client → server)

- `driver_online` — `{ type, driver_id }` (seat count is loaded from `Car.capacity` in DB)
- `rider_request` — `{ type, rider_id }`
- `select_rider` — `{ type, driver_id, rider_id }`
- `accept_match` — `{ type, rider_id, driver_id }`
- `reject_match` — `{ type, rider_id, driver_id }`

## WebSocket events (server → client)

- `initial_state` — snapshot of room riders/drivers/pending matches
- `driver_joined`
- `rider_joined`
- `rider_reserved`
- `match_request` (to rider)
- `match_rejected`
- `rider_removed`
- `seat_update`
- `match_confirmed` (to selected driver after rider accepts):
  - `ride`: accepted ride row (`id`, `driver_id`, `rider_id`, `ride_date`, `start_time`, `location`, `status`, …)
  - `rider`: rider profile basics (`id`, `name`, `residence`, `picture_url`)

Persisted rides use the Supabase **`Rides`** table (`ride_date`, `start_time`, `location`, etc.).
