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

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const DAY_LABELS = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// Group rides by day + start_time slot (same slot can have multiple ride rows / riders)
function groupRides(rides) {
  const map = new Map();
  for (const ride of rides) {
    const key = `${ride.day}|${ride.start_time}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        day: ride.day,
        start_time: ride.start_time,
        pickup_loc: ride.pickup_loc ?? ride.location ?? null,
        dropoff_loc: ride.dropoff_loc ?? null,
        riders: [],
        rideIds: [],
      });
    }
    const g = map.get(key);
    g.riders.push(ride.rider);
    if (ride.id != null) {
      g.rideIds.push(String(ride.id));
    }
  }
  // Sort by day order
  return Array.from(map.values()).sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  );
}

export default function ScheduledRidesDriver() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [completingKey, setCompletingKey] = useState(null);

  useEffect(() => {
    loadRides();
  }, []);

  async function loadRides() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);

      if (!BACKEND_URL) {
        setGroups([]);
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const url = `${normalizedBackendUrl}/api/driver/rides?driver_id=${encodeURIComponent(
        user.id,
      )}`;
      const res = await fetch(url);

      if (!res.ok) {
        setGroups([]);
        return;
      }
      const payload = await res.json();
      const rides = payload?.rides ?? [];
      if (!rides.length) {
        setGroups([]);
        return;
      }
      const grouped = groupRides(rides);
      setGroups(grouped);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  async function completeRides(groupKey, rideIds) {
    if (!rideIds?.length || completingKey) return;
    const stored = await AsyncStorage.getItem("@user");
    if (!stored || !BACKEND_URL) return;
    const user = JSON.parse(stored);
    setCompletingKey(groupKey);
    try {
      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${normalizedBackendUrl}/api/driver/rides`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({ ride_ids: rideIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(
          "Could not complete ride",
          payload?.error || "Try again.",
        );
        return;
      }
      await loadRides();
    } catch {
      Alert.alert("Error", "Could not complete ride. Try again.");
    } finally {
      setCompletingKey(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Upcoming Rides</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming rides.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  router.push({
                    pathname: "/driver/RideDetail",
                    params: {
                      day: group.day,
                      start_time: group.start_time,
                      pickup_loc: group.pickup_loc ?? "",
                      dropoff_loc: group.dropoff_loc ?? "",
                      riders: JSON.stringify(group.riders),
                    },
                  })
                }
              >
                <Text style={styles.dayLabel}>{DAY_LABELS[group.day] ?? group.day}</Text>

                <View style={styles.rowLine}>
                  <Text style={styles.metaLabel}>From</Text>
                  <Text style={styles.metaValue}>{group.pickup_loc ?? "—"}</Text>
                  <Text style={styles.metaLabel}>  To</Text>
                  <Text style={styles.metaValue}>{group.dropoff_loc ?? "—"}</Text>
                </View>

                <View style={styles.rowLine}>
                  <Text style={styles.metaLabel}>Pick Up</Text>
                  <Text style={styles.metaValue}>{formatTime12h(group.start_time)}</Text>
                </View>

                <View style={styles.riderCountBox}>
                  <Text style={styles.riderCountText}>
                    {group.riders.length}{" "}
                    {group.riders.length === 1 ? "rider" : "riders"}
                  </Text>
                  {group.riders.map((r, i) => (
                    <Text key={i} style={styles.riderDot}>
                      • {r.name ?? "Unknown"}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>

              {group.rideIds?.length > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    completingKey === group.key && styles.completeButtonDisabled,
                  ]}
                  disabled={completingKey != null}
                  onPress={() => completeRides(group.key, group.rideIds)}
                  activeOpacity={0.85}
                >
                  {completingKey === group.key ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.completeButtonText}>Complete ride</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 24,
    paddingTop: 56,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
  },
  list: {
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 4,
  },
  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  riderCountBox: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  riderCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 4,
  },
  riderDot: {
    fontSize: 13,
    color: "#0F172A",
  },
  completeButton: {
    marginTop: 14,
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  completeButtonDisabled: {
    opacity: 0.75,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 40,
  },
});
