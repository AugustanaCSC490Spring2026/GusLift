/** True when fallback targets a rider/driver screen (role-scoped navigation). */
function isRoleScopedHref(href) {
  return (
    typeof href === "string" &&
    (href.startsWith("/rider/") || href.startsWith("/driver/"))
  );
}

/**
 * Reliable back navigation.
 * For rider/driver screens, always `replace` the fallback so web history cannot
 * pop back to the other role's home after switching roles or opening history repeatedly.
 */
export function safeGoBack(router, fallbackHref = "/") {
  if (!router) return;

  if (fallbackHref && isRoleScopedHref(fallbackHref)) {
    router.replace(fallbackHref);
    return;
  }

  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  if (fallbackHref) {
    router.replace(fallbackHref);
  }
}

/** Prevent parent Pressables from receiving the same tap (needed on web). */
export function stopPressPropagation(event) {
  event?.stopPropagation?.();
  if (typeof event?.preventDefault === "function") {
    event.preventDefault();
  }
}
