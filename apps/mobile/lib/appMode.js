import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_APP_MODE_KEY = "@user_last_app_mode";

/** `rider` | `driver` from an Expo Router pathname. */
export function modeFromPathname(pathname) {
  const path = String(pathname ?? "");
  if (path.includes("/rider/")) return "rider";
  if (path.includes("/driver/")) return "driver";
  return null;
}

export async function getLastAppMode() {
  try {
    const raw = await AsyncStorage.getItem(LAST_APP_MODE_KEY);
    return raw === "rider" || raw === "driver" ? raw : null;
  } catch {
    return null;
  }
}

export async function setLastAppMode(mode) {
  if (mode !== "rider" && mode !== "driver") return;
  await AsyncStorage.setItem(LAST_APP_MODE_KEY, mode);
}

/**
 * Which rider/driver experience menu actions should use.
 * Prefers the screen you are on, then last visited mode — not stored signup role alone.
 */
export async function resolveAppMode({ pathname, storedRole } = {}) {
  const fromPath = modeFromPathname(pathname);
  if (fromPath) return fromPath;

  const last = await getLastAppMode();
  if (last) return last;

  if (storedRole === "driver" || storedRole === "rider") return storedRole;
  return "rider";
}

export function riderHomeHref() {
  return "/rider/RiderHome";
}

export function driverHomeHref() {
  return "/driver/DriverHome";
}

export function scheduledRidesHref(mode) {
  return mode === "driver"
    ? "/driver/ScheduledRidesDriver?tab=upcoming"
    : "/rider/ScheduledRidesRider?tab=upcoming";
}

export function rideHistoryHref(mode) {
  return mode === "driver"
    ? "/driver/RideHistoryDriver"
    : "/rider/RideHistoryRider";
}
