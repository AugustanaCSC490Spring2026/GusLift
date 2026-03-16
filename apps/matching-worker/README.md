# GusLift Matching Worker

Cloudflare Worker + Durable Object for real-time driver–rider matching. Routes by slot key `location:day:start_time` (e.g. `AUGIE:mon:08:00`).

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

Clients must send a Supabase JWT: `Authorization: Bearer <access_token>` or query `?token=<access_token>`. The Worker decodes the token for user id and fetches User + schedule from Supabase to resolve the slot.

### Riders without schedules

If a rider has no schedule row (or no entry for today), client can pass slot inputs in the WebSocket URL query:

- `location` (required with override)
- `time` in `HH:MM` 24h (required with override)
- `day` optional (`mon|tue|wed|thu|fri|sat|sun`, defaults to current UTC day)

Example:

`wss://<worker-domain>?token=<jwt>&location=Augie&time=08:00&day=mon`

## WebSocket events (client → server)

- `driver_online` — `{ type, driver_id }` (seat count is loaded from `Car.capacity` in DB)
- `rider_request` — `{ type, rider_id }`
- `select_rider` — `{ type, driver_id, rider_id }`
- `accept_match` — `{ type, rider_id, driver_id }`

## WebSocket events (server → client)

- `initial_state` — snapshot of room riders/drivers/pending matches
- `rider_joined`
- `rider_reserved`
- `match_request` (to rider)
- `rider_removed`
- `seat_update`
- `match_confirmed` (to selected driver after rider accepts):
  - `ride`: accepted ride row (`id`, `driver_id`, `rider_id`, `day`, `start_time`, `location`, `status`, `completed`, `created_at`)
  - `rider`: rider profile basics (`id`, `name`, `residence`, `picture_url`)
