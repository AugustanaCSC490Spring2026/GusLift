import {
  DRIVER_POST_COMPLETION_PATH,
  RIDER_POST_COMPLETION_PATH,
} from "./completionFlowConstants";

/** Run `router.replace` from a screen inside the Expo Router tree (e.g. root layout). */
export function navigateToRoleRidesDashboard(router, role) {
  if (!router) return;

  const pathname =
    role === "driver" ? DRIVER_POST_COMPLETION_PATH : RIDER_POST_COMPLETION_PATH;

  router.replace({
    pathname,
    params: {
      tab: "upcoming",
      fromCompletion: String(Date.now()),
    },
  });
}

let redirectHandler = null;

export function setPostCompletionRedirectHandler(handler) {
  redirectHandler = handler;
}

export function runPostCompletionRedirect(role) {
  redirectHandler?.(role);
}
