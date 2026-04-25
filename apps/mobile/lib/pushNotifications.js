import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
  if (Platform.OS === "web") return null;
  const base = normalizeBackendUrl();
  if (!base) return null;

  const stored = await AsyncStorage.getItem("@user");
  if (!stored) return null;

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }
  const userId = typeof parsed?.id === "string" ? parsed.id.trim() : "";
  if (!userId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = getProjectId();
  const tokenRes = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenRes?.data?.trim();
  if (!token) return null;

  const response = await fetch(`${base}/api/notifications/token`, {
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
  if (!response.ok) {
    throw new Error(`Push token registration failed (${response.status})`);
  }
  return token;
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
