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

- `driver_online` — `{ type, driver_id, seats }`
- `rider_request` — `{ type, rider_id }`
- `select_rider` — `{ type, driver_id, rider_id }`
- `accept_match` — `{ type, rider_id, driver_id }`

See `ride_matching_cursor_implementation.md` in the backend app for full event and broadcast shapes.
