import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { MatchingProvider } from "../context/MatchingContext";
import {
  DriverCompletionFlowProvider,
} from "../context/DriverCompletionFlowContext";
import {
  RiderCompletionFlowProvider,
  useRiderCompletionFlow,
} from "../context/RiderCompletionFlowContext";
import GlobalMenu from "../components/GlobalMenu";
import { modeFromPathname, setLastAppMode } from "../lib/appMode";
import {
  navigateToRoleRidesDashboard,
  setPostCompletionRedirectHandler,
} from "../lib/completionNavigation";
import {
  handleRiderCompletionDetected,
  pollRiderUpcomingCompletions,
} from "../lib/riderCompletionPrompt";
import {
  getExpoNotifications,
  registerCurrentUserPushToken,
} from "../lib/pushNotifications";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const RIDER_COMPLETION_POLL_MS = 5000;

/** Screens that poll for completion themselves or should not redirect. */
const RIDER_COMPLETION_POLL_SKIP = new Set([
  "/rider/RiderHome",
  "/rider/ScheduledRidesRider",
  "/rider/RiderWaitingRoom",
  "/rider/RiderSetup",
]);

function RootLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const { startCompletionFlow } = useRiderCompletionFlow();

  useEffect(() => {
    setPostCompletionRedirectHandler((role) => {
      navigateToRoleRidesDashboard(router, role);
    });
    return () => setPostCompletionRedirectHandler(null);
  }, [router]);

  useEffect(() => {
    pathnameRef.current = pathname;
    const mode = modeFromPathname(pathname);
    if (mode) {
      void setLastAppMode(mode);
    }
  }, [pathname]);

  useEffect(() => {
    const Notifications = getExpoNotifications();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

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
    const Notifications = getExpoNotifications();
    if (!Notifications) return;
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

  useEffect(() => {
    if (modeFromPathname(pathname) !== "rider") return;
    const path = String(pathname ?? "");
    if (!path || RIDER_COMPLETION_POLL_SKIP.has(path)) return;
    if (path.toLowerCase().includes("setup")) return;
    if (!BACKEND_URL) return;

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (!stored) return;
        const user = JSON.parse(stored);
        const { justCompleted } = await pollRiderUpcomingCompletions(
          user.id,
          BACKEND_URL,
        );
        if (!justCompleted || cancelled) return;

        await handleRiderCompletionDetected({
          justCompleted,
          riderUserId: user.id,
          startCompletionFlow,
        });
      } catch {
        // best-effort
      }
    }

    void tick();
    const pollId = setInterval(tick, RIDER_COMPLETION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [pathname, startCompletionFlow]);

  return (
    <>
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
    </>
  );
}

export default function Layout() {
  return (
    <MatchingProvider>
      <RiderCompletionFlowProvider>
        <DriverCompletionFlowProvider>
          <RootLayoutInner />
        </DriverCompletionFlowProvider>
      </RiderCompletionFlowProvider>
    </MatchingProvider>
  );
}
