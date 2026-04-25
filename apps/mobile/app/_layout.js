import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
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

  useEffect(() => {
    void registerCurrentUserPushToken();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        const type = typeof data?.type === "string" ? data.type : "";
        if (type === "driver_selected_rider") {
          router.push("/rider/ScheduledRidesRider");
          return;
        }
        if (type === "rider_confirmed_match") {
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
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalMenu />
    </MatchingProvider>
  );
}