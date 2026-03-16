import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export default function RequestRide() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropoffLoc, setDropoffLoc] = useState(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/schedule?user_id=eq.${user.id}&select=pickup_loc,dropoff_loc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();

      setPickupLoc(data?.[0]?.pickup_loc ?? null);
      setDropoffLoc(data?.[0]?.dropoff_loc ?? null);
    } catch (_) {
      // leave blank
    } finally {
      setLoading(false);
    }
  }

  function handleRequest() {
    router.push({
      pathname: "/rider/RiderWaitingRoom",
      params: {
        from: pickupLoc ?? "",
        to: dropoffLoc ?? "",
      },
    });
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
      {/* X button top left */}
      <TouchableOpacity onPress={() => router.replace("/home")} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Request a Ride</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>From</Text>
          <Text style={styles.value}>{pickupLoc ?? "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.value}>{dropoffLoc ?? "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Pick Up Time</Text>
          <Text style={styles.value}>—</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.requestButton} onPress={handleRequest} activeOpacity={0.8}>
        <Text style={styles.requestButtonText}>Request</Text>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 32,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  label: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  value: {
    fontSize: 15,
    color: "#1f2937",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  requestButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  requestButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
