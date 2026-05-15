import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

// Checks the backend to see if this user already has a driver profile in the DB.
// Used on app launch when the local AsyncStorage flag is missing (e.g. fresh install).
async function checkDriverProfileInDB(userId) {
  try {
    const url = (BACKEND_URL || "").replace(/\/$/, "");
    if (!url) return false;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${url}/api/driver/schedule`, {
      headers: { "x-user-id": String(userId) },
      signal: controller.signal,
    });
    clearTimeout(timerId);
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    // Presence of any of these fields means the driver record was created
    return !!(body && (body.make || body.from || body.pickup_loc || body.residence));
  } catch {
    return false;
  }
}

/**
 * Resolves the correct route for a user based on their role and setup state.
 *
 * @param {object} parsed - The parsed @user object from AsyncStorage.
 * @param {object} [opts]
 * @param {boolean} [opts.verifyDriver=false] - When true, falls back to a DB
 *   check if the local driverSetupComplete flag is missing. Use this on app
 *   launch so that a driver who reinstalled the app still reaches DriverHome.
 * @returns {Promise<string>} An Expo Router pathname.
 */
export async function resolveRoute(parsed, { verifyDriver = false } = {}) {
  if (!parsed?.role) return "/role";

  if (parsed.role === "driver") {
    if (parsed.driverSetupComplete) return "/driver/DriverHome";

    if (verifyDriver) {
      const hasProfile = await checkDriverProfileInDB(parsed.id);
      if (hasProfile) {
        // Repair the missing flag so future launches skip the DB call
        const updated = { ...parsed, driverSetupComplete: true };
        await AsyncStorage.setItem("@user", JSON.stringify(updated));
        return "/driver/DriverHome";
      }
    }

    return "/driver/DriverSetup";
  }

  // Rider: setup is optional — always go straight to RiderHome
  return "/rider/RiderHome";
}
