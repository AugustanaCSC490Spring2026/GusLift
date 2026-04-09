import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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

export default function ScheduledRidesRider() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);

  useEffect(() => {
    loadRides();
  }, []);

  async function loadRides() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      if (!BACKEND_URL) {
        setRides([]);
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const ridesRes = await fetch(
        `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(String(user.id))}`,
      );
      if (!ridesRes.ok) {
        setRides([]);
        return;
      }
      const payload = await ridesRes.json();
      const ridesData = payload?.rides ?? [];
      if (!ridesData?.length) { setRides([]); return; }

      const enriched = ridesData
        .map((ride) => ({
          ...ride,
          day:
            ride.day ??
            (ride.ride_date
              ? new Date(ride.ride_date)
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toLowerCase()
                  .slice(0, 3)
              : null),
        }))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

      setRides(enriched);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a6b" />
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
        {rides.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming rides.</Text>
        ) : (
          rides.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: "/rider/RideDetailRider",
                  params: {
                    day: ride.day,
                    start_time: ride.start_time,
                    location: ride.location ?? "",
                    driverName: ride.driver?.name ?? "",
                    driverPic: ride.driver?.picture_url ?? "",
                    carMake: ride.car?.make ?? "",
                    carModel: ride.car?.model ?? "",
                    carColor: ride.car?.color ?? "",
                  },
                })
              }
            >
              <Text style={styles.dayLabel}>{DAY_LABELS[ride.day] ?? ride.day}</Text>

              <View style={styles.rowLine}>
                <Text style={styles.metaLabel}>From</Text>
                <Text style={styles.metaValue}>{ride.location ?? "—"}</Text>
                <Text style={styles.metaLabel}>  To</Text>
                <Text style={styles.metaValue}>Augustana College</Text>
              </View>

              <View style={styles.rowLine}>
                <Text style={styles.metaLabel}>Pick Up</Text>
                <Text style={styles.metaValue}>{formatTime12h(ride.start_time)}</Text>
              </View>

              <View style={styles.driverBox}>
                <Text style={styles.driverLabel}>Driver</Text>
                <Text style={styles.driverName}>{ride.driver?.name ?? "—"}</Text>
                {ride.car && (
                  <Text style={styles.driverCar}>
                    {ride.car.color} {ride.car.make} {ride.car.model}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    padding: 24,
    paddingTop: 56,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f6f1",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 20,
  },
  list: {
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
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
    color: "#1a3a6b",
    marginBottom: 4,
  },
  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    color: "#1f2937",
    fontWeight: "600",
  },
  driverBox: {
    marginTop: 8,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  driverLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a3a6b",
  },
  driverCar: {
    fontSize: 13,
    color: "#374151",
  },
  emptyText: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 40,
  },
});
