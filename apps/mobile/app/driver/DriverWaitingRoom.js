import { useMatching } from "../../context/MatchingContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function DriverWaitingRoom() {
  const router = useRouter();
  const { connect, send, disconnect, onMessage } = useMatching();
  const { from, pickupTime, classStart, classEnd } = useLocalSearchParams();
  const [connected, setConnected] = useState(false);

  // Pulsing animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    let unsubscribe;
    async function setup() {
      // connect() runs GET preflight then opens the WebSocket; see MatchingContext.
      const result = await connect();
      if (result?.ok && result.userId) {
        send({ type: "driver_online", driver_id: result.userId });
        setConnected(true);
      }
      unsubscribe = onMessage((msg) => {
        if (msg.type === "rider_joined" || msg.type === "initial_state") {
          router.replace({
            pathname: "/driver/AvailableRiders",
            params: { from, pickupTime, classStart, classEnd },
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
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoOffline} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>You're Online</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Status indicator */}
        <View style={styles.statusCenter}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={[styles.statusCircle, connected ? styles.statusCircleOnline : styles.statusCircleConnecting]}>
              <Ionicons name={connected ? "navigate" : "wifi"} size={28} color="#fff" />
            </View>
          </View>
          <Text style={styles.statusTitle}>
            {connected ? "Waiting for riders" : "Connecting..."}
          </Text>
          <Text style={styles.statusSub}>
            {connected
              ? "You'll be notified when riders join your area."
              : "Establishing connection to the matching service."}
          </Text>
        </View>

        {/* Trip summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's trip</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="location" size={15} color="#1a3a6b" />
            </View>
            <Text style={styles.summaryLabel}>From</Text>
            <Text style={styles.summaryValue}>{from || "—"}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="time-outline" size={15} color="#1a3a6b" />
            </View>
            <Text style={styles.summaryLabel}>Pick up at</Text>
            <Text style={styles.summaryValue}>{formatTime12h(pickupTime)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="school-outline" size={15} color="#1a3a6b" />
            </View>
            <Text style={styles.summaryLabel}>Class</Text>
            <Text style={styles.summaryValue}>
              {formatTime12h(classStart)} → {formatTime12h(classEnd)}
            </Text>
          </View>
        </View>
      </View>

      {/* Go offline */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.offlineBtn} onPress={handleGoOffline} activeOpacity={0.85}>
          <Ionicons name="power" size={18} color="#64748b" />
          <Text style={styles.offlineBtnText}>Go Offline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f5f0" },

  header: {
    backgroundColor: "#0f1f3d", paddingTop: 56, paddingHorizontal: 20,
    paddingBottom: 20, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },

  body: { flex: 1, padding: 24, gap: 24 },

  // Status
  statusCenter: { alignItems: "center", gap: 12, paddingTop: 24 },
  pulseWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(26,58,107,0.12)",
  },
  statusCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#1a3a6b", shadowOpacity: 0.3,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  statusCircleOnline: { backgroundColor: "#22c55e" },
  statusCircleConnecting: { backgroundColor: "#94a3b8" },
  statusTitle: { fontSize: 22, fontWeight: "800", color: "#0a1628", letterSpacing: -0.3 },
  statusSub: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 21, maxWidth: 260 },

  // Summary card
  summaryCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 0,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  summaryIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center",
  },
  summaryLabel: { flex: 1, fontSize: 14, color: "#64748b", fontWeight: "500" },
  summaryValue: { fontSize: 14, fontWeight: "700", color: "#0a1628" },
  summaryDivider: { height: 1, backgroundColor: "#f8faff", marginHorizontal: 4 },

  // Footer
  footer: { padding: 20, paddingBottom: 36 },
  offlineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f1f5f9", borderRadius: 16, paddingVertical: 15, gap: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  offlineBtnText: { fontSize: 16, fontWeight: "700", color: "#64748b" },
});
