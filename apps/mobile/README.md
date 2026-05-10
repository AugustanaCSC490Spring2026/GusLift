# GusLift Mobile (Expo)

React Native app for GusLift (Expo Router). This README covers **project-specific** setup; for generic Expo docs, see [expo.dev](https://docs.expo.dev/).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables (see below).

3. Start the app

   ```bash
   npx expo start
   ```

## Environment variables

Set these for local development (e.g. `.env` with Expo’s `EXPO_PUBLIC_*` convention):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (REST, auth) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_BACKEND_URL` | GusLift backend base URL for setup, rides, and payments APIs |
| `EXPO_PUBLIC_MATCHING_WORKER_URL` | Matching worker base URL (`https://…` or `wss://…` — `MatchingContext` normalizes to WebSocket) |

Without `EXPO_PUBLIC_MATCHING_WORKER_URL`, matching `connect()` will not open a socket.

## Stripe demo checkout

The developer menu includes a **Stripe Demo Checkout** screen that creates a
hosted Stripe Checkout Session from the backend and opens it in the in-app
browser.

For the demo, configure the backend with Stripe test keys and set
`EXPO_PUBLIC_BACKEND_URL` in the mobile app so it can call:

- `GET /api/payments/config`
- `POST /api/payments/checkout-session`

The screen uses a fixed `$5.00` sandbox payment and is intended for sprint/demo
flows rather than production billing.

## Rider: requesting rides

**Request a Ride** (`app/rider/RequestRide.js`) supports two paths:

1. **Custom pickup time (manual / one-off)** — Shown first on the screen. The rider enters pickup location, optional “going to” (display only), and **24h time** (`HH:MM`). This is for trips not tied to “first class of the day” on the schedule (e.g. leaving class, heading home). Navigation passes `matchMode=manual`, `from`, `to`, and `time` into the waiting room.

2. **Match using your schedule** — Uses saved pickup/dropoff from `schedule` and the worker’s default slot for **today’s first class**. Navigation passes `matchMode=schedule`.

**Rider waiting room** (`app/rider/RiderWaitingRoom.js`):

- **`matchMode=manual`**: connects with `location` + `time` query params immediately (after a GET preflight inside `MatchingContext`).
- **`matchMode=schedule`**: connects using schedule-based resolution; if the worker reports **manual time required** (no block for today), the UI prompts for location/time and retries.

**MatchingContext** (`context/MatchingContext.js`): `connect({ location, time, day })` runs a **GET** to the worker with the same query string as the WebSocket, then upgrades. Returns `{ ok, userId }`, `{ needsManualTime, message }`, or `{ ok: false, error }`.

## Driver flow

Driver screens use the same `connect()` helper (e.g. `app/driver/DriverWaitingRoom.js`) and can pass `location` + `time` when offering a ride with explicit pickup time.

---

## Expo starter notes

This project was created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app). You can reset the starter example:

```bash
npm run reset-project
```

This moves the example into `app-example` and creates a blank `app` directory.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction)
