import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BellIcon } from "../components/Icons";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function getStoredUser() {
    const stored = await AsyncStorage.getItem("@user");
    if (!stored) return null;
    return JSON.parse(stored);
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const user = await getStoredUser();
      if (!user?.id) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }
      if (!BACKEND_URL) {
        Alert.alert(
          "Backend URL missing",
          "Set EXPO_PUBLIC_BACKEND_URL in apps/mobile/.env and restart Expo.",
        );
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${normalizedBackendUrl}/api/notifications?limit=50`, {
        headers: { "x-user-id": String(user.id) },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Could not load notifications.");
      }
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unread_count || 0));
    } catch (error) {
      Alert.alert(
        "Notifications unavailable",
        error instanceof Error ? error.message : "Could not load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    try {
      const user = await getStoredUser();
      if (!user?.id || !BACKEND_URL) return;
      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${normalizedBackendUrl}/api/notifications`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Could not mark notifications read.");
      }
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        })),
      );
    } catch (error) {
      Alert.alert(
        "Could not update notifications",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>x</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.markButton, unreadCount === 0 && styles.markButtonDisabled]}
          onPress={markAllRead}
          disabled={unreadCount === 0 || markingRead}
          activeOpacity={0.82}
        >
          <Text style={styles.markButtonText}>
            {markingRead ? "Marking..." : "Mark all read"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <BellIcon size={22} color="#3B82F6" />
          </View>
          <View style={styles.titleTextWrap}>
            <Text style={styles.eyebrow}>Updates</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              Match, ride, and payment updates will collect here.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.emptyText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <BellIcon size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptyText}>
              You will see match requests, ride confirmations, and reminders here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => {
            const unread = !item.read_at;
            return (
              <View
                key={item.id}
                style={[styles.notificationCard, unread && styles.notificationUnread]}
              >
                <View style={styles.notificationTopRow}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.notificationBody}>{item.body}</Text>
                <Text style={styles.notificationTime}>
                  {formatNotificationTime(item.created_at)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 18,
  },
  markButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  markButtonDisabled: {
    opacity: 0.45,
  },
  markButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3B82F6",
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  titleRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 18,
    marginBottom: 4,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  titleTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#3B82F6",
    marginBottom: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 26,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  notificationUnread: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC",
  },
  notificationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3B82F6",
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
});
