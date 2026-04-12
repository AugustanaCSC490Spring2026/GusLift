import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMatching } from "../../context/MatchingContext";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTime12h(timeStr) {
  if (!timeStr || !TIME_RE.test(String(timeStr).trim())) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function DriverWaitingRoom() {
  const router = useRouter();
  const { connect, send, disconnect, onMessage } = useMatching();
  
  const params = useLocalSearchParams();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  const matchMode = Array.isArray(params.matchMode) ? params.matchMode[0] : params.matchMode;
  const time = Array.isArray(params.time) ? params.time[0] : params.time;
  const pickupTime = Array.isArray(params.pickupTime) ? params.pickupTime[0] : params.pickupTime;
  const classStart = Array.isArray(params.classStart) ? params.classStart[0] : params.classStart;
  const classEnd = Array.isArray(params.classEnd) ? params.classEnd[0] : params.classEnd;
  
  const isManualEntry = matchMode === "manual";

  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let unsubscribe;

    async function setup() {
      // connect() runs GET preflight then opens the WebSocket; see MatchingContext.
      const result = isManualEntry 
        ? await connect({ location: from, time })
        : await connect();
        
      if (result?.ok && result.userId) {
        send({ type: "driver_online", driver_id: result.userId });
        setConnected(true);
        setStatusMessage("");
      } else if (result?.needsManualTime) {
        setStatusMessage(result.message || "No class block found for today.");
      } else if (result?.error) {
        setStatusMessage(result.error);
      } else {
        setStatusMessage("Unable to go online right now.");
      }

      unsubscribe = onMessage((msg) => {
        // A rider joined the room — go to available riders
        if (msg.type === "rider_joined" || msg.type === "initial_state") {
          router.replace({
            pathname: "/driver/AvailableRiders",
            params: { 
              from, 
              pickupTime: isManualEntry ? time : pickupTime, 
              classStart, 
              classEnd,
              to,
              matchMode
            },
          });
        }
      });
    }

    setup();
    return () => unsubscribe?.();
  }, []);

  function handleGoOffline() {
    disconnect();
    router.replace("/home");
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleGoOffline} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Ride Offered</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Pick up at</Text>
          <Text style={styles.value}>{from || "—"}</Text>
        </View>
        <View style={styles.divider} />
        
        {isManualEntry && to ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>To</Text>
              <Text style={styles.value}>{to}</Text>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label}>Pick Up Time</Text>
          <Text style={styles.value}>
            {formatTime12h(isManualEntry ? time : pickupTime)}
          </Text>
        </View>
        
        {!isManualEntry ? (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Class Starts</Text>
              <Text style={styles.value}>{formatTime12h(classStart)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Class End</Text>
              <Text style={styles.value}>{formatTime12h(classEnd)}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.statusRow}>
        {connected ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.statusOnline}>Online — waiting for riders</Text>
          </>
        ) : !statusMessage ? (
          <>
            <ActivityIndicator size="small" color="#1a3a6b" />
            <Text style={styles.statusConnecting}>Connecting...</Text>
          </>
        ) : (
          <Text style={styles.statusConnecting}>Unable to connect</Text>
        )}
      </View>
      {!connected && !!statusMessage ? (
        <Text style={styles.statusError}>{statusMessage}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.offlineButton}
        onPress={handleGoOffline}
        activeOpacity={0.8}
      >
        <Text style={styles.offlineButtonText}>Go Offline</Text>
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 28,
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
    marginBottom: 28,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  label: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
  value: { fontSize: 15, color: "#1f2937", fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },
  statusOnline: { fontSize: 14, color: "#22c55e", fontWeight: "600" },
  statusConnecting: { fontSize: 14, color: "#6b7280", marginLeft: 8 },
  statusError: { fontSize: 14, color: "#b91c1c", marginBottom: 20 },
  offlineButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  offlineButtonText: { color: "#374151", fontSize: 17, fontWeight: "700" },
});
