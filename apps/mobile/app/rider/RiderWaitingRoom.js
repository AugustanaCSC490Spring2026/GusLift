import { useMatching } from "../../context/MatchingContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function RiderWaitingRoom() {
  const router = useRouter();
  const { connect, send, onMessage, disconnect } = useMatching();
  const { from, to } = useLocalSearchParams();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let unsubscribe;

    async function setup() {
      const userId = await connect();
      if (userId) {
        send({ type: "rider_request", rider_id: userId });
        setConnected(true);
      }

      unsubscribe = onMessage((msg) => {
        // Driver selected this rider — go to available drivers
        if (msg.type === "match_request") {
          router.replace({
            pathname: "/rider/AvailableDrivers",
            params: { from, to, driverId: msg.driver_id },
          });
        }
      });
    }

    setup();
    return () => unsubscribe?.();
  }, []);

  function handleCancel() {
    disconnect();
    router.replace("/home");
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Ride Requested</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>From</Text>
          <Text style={styles.value}>{from || "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.value}>{to || "—"}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        {connected ? (
          <>
            <ActivityIndicator size="small" color="#1a3a6b" />
            <Text style={styles.statusText}>Getting you a ride...</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color="#9ca3af" />
            <Text style={styles.statusConnecting}>Connecting...</Text>
          </>
        )}
      </View>
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
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "700", color: "#1f2937", marginBottom: 28 },
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
    marginBottom: 28,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  label: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
  value: { fontSize: 15, color: "#1f2937", fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { fontSize: 15, color: "#1a3a6b", fontWeight: "600" },
  statusConnecting: { fontSize: 15, color: "#9ca3af" },
});
