import { Stack, useRouter, usePathname } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { MatchingProvider } from "../context/MatchingContext";
import GlobalMenu from "../components/GlobalMenu";
import { registerCurrentUserPushToken } from "../lib/pushNotifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    void registerCurrentUserPushToken();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerCurrentUserPushToken();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        const type = typeof data?.type === "string" ? data.type : "";
        if (type === "driver_selected_rider") {
          if (pathnameRef.current === "/rider/AvailableDrivers") return;
          const driverId = typeof data?.driver_id === "string" ? data.driver_id : "";
          router.push({
            pathname: "/rider/AvailableDrivers",
            params: driverId ? { driverId } : undefined,
          });
          return;
        }
        if (type === "rider_confirmed_match") {
          if (pathnameRef.current === "/driver/ScheduledRidesDriver") return;
          router.push("/driver/ScheduledRidesDriver");
        }
      },
    );
    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <MatchingProvider>
      {/* Keep a consistent sans-serif stack on web without custom font package dependency. */}
      {Platform.OS === "web" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important; }
            `,
          }}
        />
      )}
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalMenu />
    </MatchingProvider>
  );
}