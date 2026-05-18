import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatRideDateShort,
  formatTime12h,
} from "../../lib/rideDisplayTime";
import RatingPill from "../../components/RatingPill";
import {
  buildRiderRideDetailHistoryParams,
  hasStarScore,
} from "../../lib/ratingUtils";
import { safeGoBack } from "../../lib/navigation";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const DAY_LABELS = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export default function RideHistoryRider() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [hidingId, setHidingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    void loadHistory();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  async function loadHistory() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setUserId(user.id);

      if (!BACKEND_URL) {
        setRides([]);
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(
        `${normalizedBackendUrl}/api/rides/history?rider_id=${encodeURIComponent(user.id)}`,
      );
      if (!res.ok) {
        setRides([]);
        return;
      }

      const payload = await res.json();
      setRides(payload?.rides ?? []);
    } catch (_) {
      // keep prior list
    } finally {
      setLoading(false);
    }
  }

  async function hideRide(rideId) {
    if (hidingId || clearingAll || !userId) return;
    setHidingId(rideId);
    try {
      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${normalizedBackendUrl}/api/rides/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ ride_ids: [rideId], user_type: "rider" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        Alert.alert("Error", payload?.error || "Could not remove ride.");
        return;
      }
      setRides((prev) => prev.filter((r) => String(r.id) !== String(rideId)));
    } catch {
      Alert.alert("Error", "Could not remove ride. Try again.");
    } finally {
      setHidingId(null);
    }
  }

  async function clearAll() {
    if (clearingAll || !userId || rides.length === 0) return;
    Alert.alert(
      "Clear All History",
      "This will remove all rides from your history. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setClearingAll(true);
            try {
              const allIds = rides.map((r) => String(r.id));
              const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
              const res = await fetch(`${normalizedBackendUrl}/api/rides/history`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": String(userId),
                },
                body: JSON.stringify({ ride_ids: allIds, user_type: "rider" }),
              });
              if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                Alert.alert("Error", payload?.error || "Could not clear history.");
                return;
              }
              setRides([]);
            } catch {
              Alert.alert("Error", "Could not clear history. Try again.");
            } finally {
              setClearingAll(false);
            }
          },
        },
      ],
    );
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
      <TouchableOpacity
        onPress={() => safeGoBack(router, "/rider/RiderHome")}
        style={styles.closeButton}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.header}>Ride History</Text>
          <Text style={styles.roleHint}>Rider · tap a ride to rate your driver</Text>
        </View>
        {rides.length > 0 && (
          <TouchableOpacity
            onPress={clearAll}
            disabled={clearingAll}
            activeOpacity={0.7}
          >
            <Text style={styles.clearAllText}>
              {clearingAll ? "Clearing…" : "Clear All"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rides.length === 0 ? (
          <Text style={styles.emptyText}>No ride history.</Text>
        ) : (
          rides.map((ride) => (
            <View key={ride.id} style={styles.card}>
              <TouchableOpacity
                style={styles.hideButton}
                onPress={() => hideRide(ride.id)}
                disabled={hidingId != null || clearingAll}
                activeOpacity={0.6}
              >
                {hidingId === ride.id ? (
                  <ActivityIndicator size="small" color="#9ca3af" />
                ) : (
                  <Text style={styles.hideButtonText}>✕</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cardBody}
                activeOpacity={0.8}
                onPress={() => {
                  const params = buildRiderRideDetailHistoryParams(ride);
                  if (params) {
                    router.push({
                      pathname: "/rider/RideDetailHistory",
                      params,
                    });
                  }
                }}
              >

              <Text style={styles.dateLabel}>
                {formatRideDateShort(ride.ride_date) ??
                  DAY_LABELS[ride.day] ??
                  ride.day ??
                  "—"}
              </Text>

              <View style={styles.rowLine}>
                <Text style={styles.metaLabel}>From</Text>
                <Text style={styles.metaValue}>{ride.pickup_loc ?? ride.location ?? "—"}</Text>
                <Text style={styles.metaLabel}>  To</Text>
                <Text style={styles.metaValue}>{ride.dropoff_loc ?? "—"}</Text>
              </View>

              <View style={styles.rowLine}>
                <Text style={styles.metaLabel}>Pick Up</Text>
                <Text style={styles.metaValue}>{formatTime12h(ride.start_time)}</Text>
              </View>

              <View style={styles.driverBox}>
                <Text style={styles.driverLabel}>Driver</Text>
                <Text style={styles.driverName}>{ride.driver?.name ?? "Unknown"}</Text>
                {ride.car && (
                  <Text style={styles.driverCar}>
                    {ride.car.color} {ride.car.make} {ride.car.model}
                  </Text>
                )}
              </View>

              <View style={styles.ratingAndStatus}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
                </View>
                {hasStarScore(ride.my_rating) ? (
                  <RatingPill score={ride.my_rating} variant="compact" />
                ) : (
                  <RatingPill variant="cta" ctaLabel="Rate driver" />
                )}
              </View>
              </TouchableOpacity>
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
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  roleHint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  header: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },
  list: {
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
    overflow: "hidden",
  },
  cardBody: {
    padding: 18,
    gap: 8,
  },
  hideButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  hideButtonText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 4,
    paddingRight: 36,
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
  driverBox: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  driverLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
  },
  driverCar: {
    fontSize: 13,
    color: "#64748B",
  },
  ratingAndStatus: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },
  emptyText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 40,
  },
});
