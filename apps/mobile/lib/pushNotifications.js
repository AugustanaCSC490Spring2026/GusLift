import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

let expoNotificationsModule;
export function getExpoNotifications() {
  if (expoNotificationsModule !== undefined) return expoNotificationsModule;
  if (Platform.OS === "web") {
    expoNotificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoNotificationsModule = require("expo-notifications");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[notifications] expo-notifications failed to load — rebuild the dev client: npx expo run:android",
      e?.message || String(e),
    );
    expoNotificationsModule = null;
  }
  return expoNotificationsModule;
}

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || "";

function normalizeBackendUrl() {
  return BACKEND_URL.trim().replace(/\/$/, "");
}

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

export async function registerCurrentUserPushToken() {
  try {
    if (Platform.OS === "web") return null;
    const Notifications = getExpoNotifications();
    if (!Notifications) return null;
    const base = normalizeBackendUrl();
    if (!base) {
      console.log("[push] no BACKEND_URL configured");
      return null;
    }

    const stored = await AsyncStorage.getItem("@user");
    if (!stored) {
      console.log("[push] skip: no stored @user");
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return null;
    }
    const userId = typeof parsed?.id === "string" ? parsed.id.trim() : "";
    if (!userId) {
      console.log("[push] skip: no userId in stored @user");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
      console.log("[push] android channel ok");
    }

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;
    console.log("[push] permission status:", finalStatus);
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
      console.log("[push] permission after request:", finalStatus);
    }
    if (finalStatus !== "granted") {
      console.log("[push] permission denied, aborting");
      return null;
    }

    const projectId = getProjectId();
    console.log("[push] projectId:", projectId);

    let devicePushToken = null;
    try {
      const dev = await Notifications.getDevicePushTokenAsync();
      devicePushToken = dev?.data || null;
      console.log("[push] device token type:", dev?.type, "len:", typeof devicePushToken === "string" ? devicePushToken.length : "n/a");
    } catch (e) {
      console.log("[push] getDevicePushTokenAsync failed:", e?.message || String(e));
    }

    try {
      const probe = await fetch("https://exp.host/", { method: "GET" });
      console.log("[push] exp.host probe:", probe.status);
    } catch (e) {
      console.log("[push] exp.host probe failed:", e?.message || String(e));
    }

    let token;
    try {
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      token = tokenRes?.data?.trim();
      console.log("[push] expo token ok:", token ? `${token.slice(0, 18)}...` : "(empty)");
    } catch (e) {
      console.log("[push] getExpoPushTokenAsync failed:", e?.message || String(e));
      return null;
    }
    if (!token) return null;

    let response;
    try {
      response = await fetch(`${base}/api/notifications/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
        }),
      });
    } catch (e) {
      console.log("[push] backend POST failed:", e?.message || String(e), "url:", `${base}/api/notifications/token`);
      return null;
    }
    if (!response.ok) {
      console.log("[push] backend rejected token:", response.status);
      return null;
    }
    console.log("[push] token registered for user", userId);
    return token;
  } catch (e) {
    console.log("[push] unexpected registration error:", e?.message || String(e));
    return null;
  }
}

export async function deactivateCurrentUserPushToken() {
  if (Platform.OS === "web") return;
  const base = normalizeBackendUrl();
  if (!base) return;

  const stored = await AsyncStorage.getItem("@user");
  if (!stored) return;

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return;
  }
  const userId = typeof parsed?.id === "string" ? parsed.id.trim() : "";
  if (!userId) return;

  try {
    await fetch(`${base}/api/notifications/token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    });
  } catch {
    // Best effort; sign-out flow should continue.
  }
}
