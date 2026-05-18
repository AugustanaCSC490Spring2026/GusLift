import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearLastCompletedForPrompt,
  fetchHistoryRideById,
  getLastCompletedForPrompt,
  hasStarScore,
  isWithinRatingToastWindow,
  markRatingPromptHandled,
  normRideId,
  resolveDriverIdFromRide,
  rideNeedsRating,
  storeLastCompletedForPrompt,
  wasRatingPromptHandled,
} from "./ratingUtils";

const RIDER_UPCOMING_SNAPSHOT_KEY = "@rider_upcoming_snapshot";
const RIDER_COMPLETION_SNAPSHOT_KEY = "@rider_completion_snapshot";

import {
  isRiderPostCompletionScreen,
  RIDER_POST_COMPLETION_PATH,
} from "./completionFlowConstants";

/** Rider home (request ride). */
export const RIDER_DASHBOARD_PATH = "/rider/RiderHome";

export { RIDER_POST_COMPLETION_PATH, isRiderPostCompletionScreen };

export function isRiderDashboardPath(pathname) {
  const path = String(pathname ?? "");
  return path === RIDER_DASHBOARD_PATH || path.endsWith("/RiderHome");
}

export async function fetchRiderUpcomingRides(riderUserId, backendUrl) {
  const normalizedBackendUrl = backendUrl?.replace(/\/$/, "");
  if (!normalizedBackendUrl || !riderUserId) return [];

  const res = await fetch(
    `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(
      String(riderUserId),
    )}`,
  );
  if (!res.ok) return [];
  const payload = await res.json();
  return payload?.rides ?? [];
}

function minimalRideSnapshot(ride) {
  return {
    id: ride.id,
    driver: ride.driver,
    driver_id: ride.driver_id,
    created_at: ride.created_at,
  };
}

export async function loadUpcomingSnapshotMap() {
  try {
    const raw = await AsyncStorage.getItem(RIDER_UPCOMING_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.rides) ? parsed.rides : [];
    const map = new Map();
    for (const ride of list) {
      const key = normRideId(ride?.id);
      if (key) map.set(key, ride);
    }
    return map;
  } catch {
    return null;
  }
}

export async function saveUpcomingSnapshotMap(rides) {
  const ridesList = Array.isArray(rides) ? rides : [];
  await AsyncStorage.setItem(
    RIDER_UPCOMING_SNAPSHOT_KEY,
    JSON.stringify({
      rides: ridesList.map(minimalRideSnapshot),
      at: Date.now(),
    }),
  );
}

/** Rides that were upcoming before but are gone now (likely completed). */
export function findRemovedUpcomingRides(prevMap, currentRides) {
  if (!prevMap || prevMap.size === 0) return [];

  const currentIds = new Set(
    currentRides.map((r) => normRideId(r.id)).filter(Boolean),
  );
  const removed = [];
  for (const [oldId, oldRide] of prevMap) {
    if (!currentIds.has(normRideId(oldId))) {
      removed.push({ id: oldId, ride: oldRide });
    }
  }
  return removed;
}

export function pickNewestRemovedRide(removed) {
  if (!removed?.length) return null;
  return removed.sort((a, b) => {
    const ta = a.ride?.created_at ? new Date(a.ride.created_at).getTime() : 0;
    const tb = b.ride?.created_at ? new Date(b.ride.created_at).getTime() : 0;
    return tb - ta;
  })[0];
}

export async function fetchRideForRatingToast(
  riderUserId,
  rideId,
  backendUrl,
  fallbackSnapshot = null,
) {
  const normalizedBackendUrl = backendUrl?.replace(/\/$/, "");
  if (!normalizedBackendUrl) return null;

  let ride =
    (await fetchHistoryRideById(riderUserId, rideId, normalizedBackendUrl)) ??
    fallbackSnapshot ??
    null;

  if (!ride && fallbackSnapshot) {
    await new Promise((r) => setTimeout(r, 1200));
    ride =
      (await fetchHistoryRideById(riderUserId, rideId, normalizedBackendUrl)) ??
      fallbackSnapshot;
  }

  return ride;
}

/**
 * Poll upcoming rides; detect removals vs last persisted snapshot.
 * Returns { currentRides, justCompleted }.
 */
export async function pollRiderUpcomingCompletions(riderUserId, backendUrl) {
  const prevMap = await loadUpcomingSnapshotMap();
  const currentRides = await fetchRiderUpcomingRides(riderUserId, backendUrl);

  let justCompleted = null;
  if (prevMap && prevMap.size > 0) {
    const removed = findRemovedUpcomingRides(prevMap, currentRides);
    justCompleted = pickNewestRemovedRide(removed);
  }

  await saveUpcomingSnapshotMap(currentRides);

  return { currentRides, justCompleted };
}

export async function storeCompletionSnapshot(snapshot) {
  if (!snapshot?.id) return;
  await AsyncStorage.setItem(
    RIDER_COMPLETION_SNAPSHOT_KEY,
    JSON.stringify({
      id: snapshot.id,
      driver: snapshot.driver,
      driver_id: snapshot.driver_id,
      created_at: snapshot.created_at,
    }),
  );
}

export async function getCompletionSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(RIDER_COMPLETION_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCompletionSnapshot() {
  await AsyncStorage.removeItem(RIDER_COMPLETION_SNAPSHOT_KEY);
}

export async function resolvePendingCompletionRideId(pendingRideIdRef) {
  const fromRef = pendingRideIdRef?.current
    ? normRideId(pendingRideIdRef.current)
    : null;
  if (fromRef) return fromRef;

  const last = await getLastCompletedForPrompt();
  if (
    last &&
    isWithinRatingToastWindow(last.at) &&
    !(await wasRatingPromptHandled(last.rideId))
  ) {
    return last.rideId;
  }

  return null;
}

export async function tryShowRiderRatingToast({
  rideId,
  riderUserId,
  backendUrl,
  fallbackSnapshot,
  isToastVisible,
  showToast,
}) {
  const id = normRideId(rideId);
  if (!id || isToastVisible()) return false;

  if (await wasRatingPromptHandled(id)) {
    await clearLastCompletedForPrompt();
    await clearCompletionSnapshot();
    return false;
  }

  const storedSnapshot = fallbackSnapshot ?? (await getCompletionSnapshot());
  const ride = await fetchRideForRatingToast(
    riderUserId,
    id,
    backendUrl,
    storedSnapshot,
  );
  if (!ride || !rideNeedsRating(ride) || hasStarScore(ride.my_rating)) {
    return false;
  }

  const shown = showToast(ride, riderUserId);
  if (shown) {
    await clearCompletionSnapshot();
  }
  return shown;
}

/**
 * Ride left upcoming → "Ride completed" overlay → rating toast → rides dashboard.
 * `startCompletionFlow` comes from RiderCompletionFlowProvider.
 */
export async function handleRiderCompletionDetected({
  justCompleted,
  riderUserId,
  startCompletionFlow,
}) {
  if (!justCompleted?.id || !startCompletionFlow) {
    return { started: false };
  }

  const started = await startCompletionFlow({
    justCompleted,
    riderUserId,
  });

  return { started };
}

export async function onRiderRideJustCompleted({
  rideId,
  riderUserId,
  backendUrl,
  fallbackSnapshot,
  isToastVisible,
  showToast,
  pendingRideIdRef,
  maxRetries = 6,
  retryMs = 1500,
}) {
  const id = normRideId(rideId);
  if (!id) return false;

  await storeLastCompletedForPrompt(id);
  if (pendingRideIdRef) pendingRideIdRef.current = id;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (isToastVisible()) return true;
    const shown = await tryShowRiderRatingToast({
      rideId: id,
      riderUserId,
      backendUrl,
      fallbackSnapshot,
      isToastVisible,
      showToast,
    });
    if (shown) {
      if (pendingRideIdRef) pendingRideIdRef.current = null;
      return true;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }

  return false;
}

export async function dismissRiderRatingToast({
  rideId,
  pendingRideIdRef,
  clearToast,
}) {
  if (pendingRideIdRef) pendingRideIdRef.current = null;
  await clearLastCompletedForPrompt();
  await clearCompletionSnapshot();
  if (rideId) {
    await markRatingPromptHandled(rideId);
  }
  clearToast();
}
