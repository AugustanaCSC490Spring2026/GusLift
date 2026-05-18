/** How long the "Ride completed" overlay stays up before the next step. */
export const COMPLETION_OVERLAY_VISIBLE_MS = 1800;

/** After overlay (and rider toast), wait this long then go to the role rides dashboard. */
export const POST_COMPLETION_REDIRECT_MS = 3000;

export const RIDER_POST_COMPLETION_PATH = "/rider/ScheduledRidesRider";
export const DRIVER_POST_COMPLETION_PATH = "/driver/ScheduledRidesDriver";

export function isRiderPostCompletionScreen(pathname) {
  const path = String(pathname ?? "");
  return (
    path === RIDER_POST_COMPLETION_PATH || path.endsWith("/ScheduledRidesRider")
  );
}

export function isDriverPostCompletionScreen(pathname) {
  const path = String(pathname ?? "");
  return (
    path === DRIVER_POST_COMPLETION_PATH || path.endsWith("/ScheduledRidesDriver")
  );
}
