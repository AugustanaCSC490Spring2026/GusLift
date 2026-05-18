import AsyncStorage from "@react-native-async-storage/async-storage";

/** Match ride ids across bigint / text (e.g. "42" vs 42). */
export function normRideId(id) {
  if (id == null || id === "") return "";
  const s = String(id).trim();
  if (/^\d+$/.test(s)) return String(Number(s));
  return s;
}

/** 1–5 star value from API (number or string); otherwise null. */
export function parseStarScore(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n);
}

export function hasStarScore(value) {
  return parseStarScore(value) != null;
}

/** `@user.role` from AsyncStorage (`"rider"` | `"driver"`). */
export async function getStoredUserRole() {
  try {
    const stored = await AsyncStorage.getItem("@user");
    if (!stored) return null;
    const role = JSON.parse(stored)?.role;
    return role === "rider" || role === "driver" ? role : null;
  } catch {
    return null;
  }
}

/** Average rating received by a user (`GET /api/ratings?user_id=…`). */
export async function fetchUserRatingSummary(userId, backendUrl) {
  const normalizedUrl = backendUrl?.replace(/\/$/, "");
  if (!normalizedUrl || userId == null || String(userId).trim() === "") {
    return { average: null, count: null };
  }
  try {
    const res = await fetch(
      `${normalizedUrl}/api/ratings?user_id=${encodeURIComponent(String(userId))}`,
    );
    if (!res.ok) return { average: null, count: null };
    const data = await res.json();
    if (!data?.success) return { average: null, count: null };
    return {
      average: typeof data.average === "number" ? data.average : null,
      count: typeof data.count === "number" ? data.count : null,
    };
  } catch {
    return { average: null, count: null };
  }
}

/** Format driver average for display (e.g. "★ 4.5 average (3)"). */
export function formatDriverAverageLabel(average, count) {
  if (average == null) {
    return count === 0 ? "No ratings yet" : null;
  }
  const base = `★ ${average.toFixed(1)} average`;
  if (count != null && count > 0) return `${base} (${count})`;
  return base;
}

const RATING_PROMPT_HANDLED_KEY = "@rating_prompt_handled";
/** Single ride that just completed — toast may show within this window after returning to Rider Home. */
const RATING_LAST_COMPLETED_KEY = "@rating_last_completed";

/** How long after completion we still offer the one-time 7s toast (not old history). */
export const RATING_TOAST_RECENT_MS = 30 * 60 * 1000;

/** Auto-dismiss duration for the post-ride rating toast. */
export const RATING_TOAST_DISMISS_MS = 7000;

export function rideNeedsRating(ride) {
  return !hasStarScore(ride?.my_rating);
}

/** Ride ids where the rider dismissed or submitted the post-ride rating prompt. */
export async function getHandledRatingPromptRideIds() {
  try {
    const raw = await AsyncStorage.getItem(RATING_PROMPT_HANDLED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => normRideId(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function markRatingPromptHandled(rideId) {
  const key = normRideId(rideId);
  if (!key) return;
  const handled = await getHandledRatingPromptRideIds();
  handled.add(key);
  await AsyncStorage.setItem(
    RATING_PROMPT_HANDLED_KEY,
    JSON.stringify([...handled]),
  );
}

export async function wasRatingPromptHandled(rideId) {
  const handled = await getHandledRatingPromptRideIds();
  return handled.has(normRideId(rideId));
}

/** Clears dismiss state so the 7s rating toast can show again (e.g. after testing). */
export async function clearAllRatingPrompts() {
  await AsyncStorage.multiRemove([
    RATING_PROMPT_HANDLED_KEY,
    RATING_LAST_COMPLETED_KEY,
  ]);
}

/** Remember the one ride that just finished (overwritten on each new completion). */
export async function storeLastCompletedForPrompt(rideId) {
  const id = normRideId(rideId);
  if (!id) return;
  await AsyncStorage.setItem(
    RATING_LAST_COMPLETED_KEY,
    JSON.stringify({ rideId: id, at: Date.now() }),
  );
}

export async function getLastCompletedForPrompt() {
  try {
    const raw = await AsyncStorage.getItem(RATING_LAST_COMPLETED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rideId = normRideId(parsed?.rideId);
    const at = Number(parsed?.at);
    if (!rideId || !Number.isFinite(at)) return null;
    return { rideId, at };
  } catch {
    return null;
  }
}

export async function clearLastCompletedForPrompt() {
  await AsyncStorage.removeItem(RATING_LAST_COMPLETED_KEY);
}

export function isWithinRatingToastWindow(completedAtMs) {
  return Date.now() - completedAtMs <= RATING_TOAST_RECENT_MS;
}

export function resolveDriverIdFromRide(ride) {
  return String(
    ride?.driver?.id ?? ride?.driver_id ?? "",
  ).trim();
}

export async function fetchHistoryRideById(riderId, rideId, backendUrl) {
  const normalizedUrl = backendUrl?.replace(/\/$/, "");
  const id = normRideId(rideId);
  if (!normalizedUrl || !riderId || !id) return null;
  try {
    const res = await fetch(
      `${normalizedUrl}/api/rides/history?rider_id=${encodeURIComponent(String(riderId))}`,
    );
    if (!res.ok) return null;
    const rides = (await res.json())?.rides ?? [];
    return rides.find((r) => normRideId(r.id) === id) ?? null;
  } catch {
    return null;
  }
}

/** First completed ride in history list that still needs a rating. */
export function findFirstUnratedRide(rides) {
  if (!Array.isArray(rides)) return null;
  return rides.find((r) => rideNeedsRating(r)) ?? null;
}

/** Newest completed ride that still needs a rating (by `created_at`). */
export function findMostRecentUnratedRide(rides) {
  if (!Array.isArray(rides)) return null;
  return (
    [...rides]
      .filter(rideNeedsRating)
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })[0] ?? null
  );
}

export function isRideToday(rideDate) {
  if (!rideDate) return false;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return String(rideDate).trim() === `${yyyy}-${mm}-${dd}`;
}

/** Route params for `/driver/RideDetailHistory` from a history API ride row. */
export function buildDriverRideDetailHistoryParams(ride) {
  if (!ride?.id) return null;
  return {
    ride_id: String(ride.id),
    ride_date: ride.ride_date ?? "",
    day: ride.day ?? "",
    start_time: ride.start_time ?? "",
    pickup_loc: ride.pickup_loc ?? ride.location ?? "",
    dropoff_loc: ride.dropoff_loc ?? "",
    rider_id: String(ride.rider?.id ?? ride.rider_id ?? ""),
    rider_name: ride.rider?.name ?? "",
    rider_residence: ride.rider?.residence ?? "",
    rider_picture_url: ride.rider?.picture_url ?? "",
    car_make: ride.car?.make ?? "",
    car_model: ride.car?.model ?? "",
    car_color: ride.car?.color ?? "",
    car_license_plate: ride.car?.license_plate ?? "",
    rating_received:
      ride.rating_received != null ? String(ride.rating_received) : "",
  };
}

/** Route params for `/rider/RideDetailHistory` from a history API ride row. */
export function buildRiderRideDetailHistoryParams(ride) {
  if (!ride?.id) return null;
  return {
    ride_id: String(ride.id),
    ride_date: ride.ride_date ?? "",
    day: ride.day ?? "",
    start_time: ride.start_time ?? "",
    pickup_loc: ride.pickup_loc ?? ride.location ?? "",
    dropoff_loc: ride.dropoff_loc ?? "",
    driver_id: String(ride.driver?.id ?? ride.driver_id ?? ""),
    driver_name: ride.driver?.name ?? "",
    driver_residence: ride.driver?.residence ?? "",
    driver_picture_url: ride.driver?.picture_url ?? "",
    car_make: ride.car?.make ?? "",
    car_model: ride.car?.model ?? "",
    car_color: ride.car?.color ?? "",
    car_license_plate: ride.car?.license_plate ?? "",
    my_rating: ride.my_rating != null ? String(ride.my_rating) : "",
  };
}

export async function fetchUnratedCompletedRide(riderId, backendUrl) {
  const normalizedUrl = backendUrl?.replace(/\/$/, "");
  if (!normalizedUrl || !riderId) return null;
  try {
    const res = await fetch(
      `${normalizedUrl}/api/rides/history?rider_id=${encodeURIComponent(String(riderId))}`,
    );
    if (!res.ok) return null;
    const payload = await res.json();
    const rides = payload?.rides ?? [];
    return findMostRecentUnratedRide(rides);
  } catch {
    return null;
  }
}
