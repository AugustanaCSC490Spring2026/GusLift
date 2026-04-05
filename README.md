## GusLift Monorepo

This repository contains:

- **Mobile app**: Expo / React Native app in `apps/mobile`
- **Web app**: Next.js app in `apps/web`
- **Matching worker**: Cloudflare Worker + Durable Object in `apps/matching-worker` (real-time driver–rider matching by time/location slot)

Each app is an independent Node project with its own `package.json` (the worker uses Wrangler).

---

## Matching (rides)

Matching runs on the **matching worker**. Slots look like `LOCATION:weekday:HH:MM` (for example `AUGIE:mon:08:00`). The worker loads the user’s **schedule** from Supabase when resolving a slot; if there is **no class block for today**, clients can still match by passing **manual** `location` and `time` query parameters (Uber-style one-off requests). Accepted rides are written to the Supabase **`Rides`** table.

**Mobile (riders)** use **Request a Ride** (`apps/mobile/app/rider/RequestRide.js`):

1. **Custom pickup time** — Enter pickup location, optional destination label, and time (`HH:MM`). Use this for trips that are not covered by “first class of the day” matching (for example leaving class or heading home).
2. **Or match using your schedule** — Uses the saved route; pickup time follows the scheduled **first class (today)** slot.

The app’s `MatchingContext` performs a **GET preflight** on the worker (same URL/query as the WebSocket) before upgrading, so the UI can detect when a **manual time** is required without failing the WebSocket handshake.

See **`apps/matching-worker/README.md`** for HTTP preflight, query parameters, and WebSocket events. See **`apps/mobile/README.md`** for rider env vars (`EXPO_PUBLIC_MATCHING_WORKER_URL`, etc.).

---

## Prerequisites

- **Node.js**: Install a recent LTS version (recommended: Node 20+).
- **npm**: Comes with Node. (You can also use `pnpm`, `yarn`, or `bun` if you prefer, but the examples below use `npm`.)
- **Git**: To clone and manage this repository.

For mobile development you will also need:

- **Expo CLI tooling** (installed automatically when you run `npx expo start`)
- At least one of:
  - Android Studio + emulator
  - Xcode + iOS simulator (macOS only)
  - Expo Go app on a physical device

---

## Installation

Clone the repository and install dependencies for each app.

```bash
git clone <your-repo-url> GusLift
cd GusLift

# Install mobile app dependencies
cd apps/mobile
npm install

# Install web app dependencies
cd ../web
npm install
```

If you prefer, you can run the installs separately later when you first work with each app.

---

## Running the Mobile App (Expo)

The mobile app lives in `apps/mobile` and is an Expo project.

From the repo root:

```bash
cd apps/mobile
npm install        # first time only
npm run start      # or: npx expo start
```

Common scripts:

- **Start Metro bundler / Expo**:

  ```bash
  npm run start
  ```

- **Run on Android emulator / device**:

  ```bash
  npm run android
  ```

- **Run on iOS simulator** (macOS only):

  ```bash
  npm run ios
  ```

- **Run in browser (Expo web)**:

  ```bash
  npm run web
  ```

Expo will print a QR code and options to open:

- a development build
- an Android emulator
- an iOS simulator
- the Expo Go app on a physical device

### Resetting the mobile starter project

If you want a fresh Expo app without the starter example, from `apps/mobile` run:

```bash
npm run reset-project
```

This moves the example into `app-example` and creates a blank `app` directory.

---

## Running the Web App (Next.js)

The web app lives in `apps/web` and is a standard Next.js (App Router) project.

From the repo root:

```bash
cd apps/web
npm install     # first time only
npm run dev
```

Then open `http://localhost:3000` in your browser.

Available scripts:

- **Development server**:

  ```bash
  npm run dev
  ```

- **Production build**:

  ```bash
  npm run build
  ```

- **Start production server** (after `npm run build`):

  ```bash
  npm run start
  ```

---

## Running Both Apps at the Same Time

Since each app is independent, you can run them in parallel:

1. **Terminal 1 – Mobile app**

   ```bash
   cd GusLift/apps/mobile
   npm run start
   ```

2. **Terminal 2 – Web app**

   ```bash
   cd GusLift/apps/web
   npm run dev
   ```

Use your browser for the web app and Expo tooling (emulator, simulator, or device) for the mobile app.

---

## Project Layout

- `apps/mobile` – Expo / React Native application
- `apps/web` – Next.js web application
- `apps/matching-worker` – Cloudflare Worker + Durable Object for matching WebSockets

Each app has its own README with more specific framework docs:

- `apps/mobile/README.md` – Expo-specific instructions and GusLift rider matching notes
- `apps/web/README.md` – Next.js-specific instructions
- `apps/matching-worker/README.md` – Worker setup, slot resolution, HTTP preflight, WebSocket protocol

