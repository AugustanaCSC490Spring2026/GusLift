import { useMatching } from "../../context/MatchingContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTime12h(timeStr) {
  if (!timeStr || !TIME_RE.test(String(timeStr).trim())) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function RiderWaitingRoom() {
  const router = useRouter();
  const { connect, send, onMessage, disconnect } = useMatching();
  const params = useLocalSearchParams();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  const matchMode = Array.isArray(params.matchMode) ? params.matchMode[0] : params.matchMode;
  const timeParam = Array.isArray(params.time) ? params.time[0] : params.time;

  const isManualEntry =
    matchMode === "manual" &&
    timeParam &&
    TIME_RE.test(String(timeParam).trim()) &&
    String(from ?? "").trim().length > 0;

  const [connected, setConnected] = useState(false);
  const [needsManualTime, setNeedsManualTime] = useState(false);
  const [manualTime, setManualTime] = useState("");
  const [manualLocation, setManualLocation] = useState(from ?? "");
  const [connectError, setConnectError] = useState(null);

  // Pulsing animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulse2Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    const pulse2 = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(pulse2Anim, { toValue: 1.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse2Anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse1.start();
    pulse2.start();
    return () => { pulse1.stop(); pulse2.stop(); };
  }, [pulseAnim, pulse2Anim]);

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    async function setup() {
      setConnectError(null);
      // MatchingContext.connect: GET preflight → WebSocket; may return needsManualTime without opening a socket.
      unsubscribe = onMessage((msg) => {
        if (msg.type === "match_request") {
          router.replace({
            pathname: "/rider/AvailableDrivers",
            params: { from, to, driverId: msg.driver_id },
          });
        }
      });

      const trimmedFrom = String(from ?? "").trim();
      const trimmedTime = timeParam ? String(timeParam).trim() : "";

      const result = isManualEntry
        ? await connect({ location: trimmedFrom, time: trimmedTime })
        : await connect();

      if (cancelled) return;

      if (result?.needsManualTime) {
        setNeedsManualTime(true);
        setManualLocation(trimmedFrom || "");
        setManualTime(trimmedTime || "");
        return;
      }
      if (result?.ok && result.userId) {
        // Same slot room as preflight; tell the DO this rider is in the queue.
        send({ type: "rider_request", rider_id: result.userId });
        setConnected(true);
        return;
      }
      setConnectError(result?.error ?? "Could not start matching. Try again.");
    }
    setup();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function handleManualContinue() {
    setConnectError(null);
    const loc = (manualLocation || from || "").trim();
    const time = manualTime.trim();
    if (!loc || !TIME_RE.test(time)) {
      return;
    }
    const result = await connect({ location: loc, time });
    if (result?.ok && result.userId) {
      setNeedsManualTime(false);
      send({ type: "rider_request", rider_id: result.userId });
      setConnected(true);
    } else if (result?.error) {
      setConnectError(result.error);
    }
  }

  async function handleRetry() {
    setConnectError(null);
    const trimmedFrom = String(from ?? "").trim();
    const trimmedTime = timeParam ? String(timeParam).trim() : "";
    const result = isManualEntry
      ? await connect({ location: trimmedFrom, time: trimmedTime })
      : await connect();
    if (result?.needsManualTime) {
      setNeedsManualTime(true);
      return;
    }
    if (result?.ok && result.userId) {
      send({ type: "rider_request", rider_id: result.userId });
      setConnected(true);
    } else {
      setConnectError(result?.error ?? "Could not connect.");
    }
  }

  function handleCancel() {
    disconnect();
    router.replace("/home");
  }

  const effectiveSlotTime =
    isManualEntry && timeParam
      ? String(timeParam).trim()
      : manualTime.trim() && TIME_RE.test(manualTime.trim())
        ? manualTime.trim()
        : null;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finding a Driver</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Animated status */}
        <View style={styles.statusCenter}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing2, { transform: [{ scale: pulse2Anim }] }]} />
            <Animated.View style={[styles.pulseRing1, { transform: [{ scale: pulseAnim }] }]} />
            <View style={[styles.statusCircle, connected ? styles.statusCircleSearching : styles.statusCircleConnecting]}>
              <Ionicons name={connected ? "search" : "wifi"} size={26} color="#fff" />
            </View>
          </View>
          <Text style={styles.statusTitle}>
            {connected ? "Looking for a driver..." : "Connecting..."}
          </Text>
          <Text style={styles.statusSub}>
            {connected
              ? "A driver heading your way will be matched shortly. Keep the app open."
              : "Establishing connection to the matching service."}
          </Text>
        </View>

        {/* Trip summary */}
        <View style={styles.tripCard}>
          <View style={styles.tripRow}>
            <View style={styles.tripDotWrap}>
              <View style={styles.tripDotFilled} />
              <View style={styles.tripLine} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Pickup from</Text>
              <Text style={styles.tripValue}>{from || "—"}</Text>
            </View>
          </View>
          <View style={styles.tripRow}>
            <View style={styles.tripDotWrap}>
              <View style={styles.tripDotOutline} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Going to</Text>
              <Text style={styles.tripValue}>{to || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={16} color="#1a3a6b" />
          <Text style={styles.tipText}>
            Tip: Make sure your pickup location is accurate so your driver can find you easily.
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Pickup time</Text>
          <Text style={styles.value}>
            {effectiveSlotTime
              ? formatTime12h(effectiveSlotTime)
              : needsManualTime
                ? "Enter below"
                : matchMode !== "manual" && !isManualEntry
                  ? "First class (today)"
                  : "—"}
          </Text>
        </View>
      </View>

      {connectError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{connectError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {needsManualTime ? (
        <View style={styles.manualBox}>
          <Text style={styles.manualTitle}>When do you need a ride?</Text>
          <Text style={styles.manualHint}>
            No class block for today on your schedule, or matching needs a one-off time. Enter pickup
            location and 24-hour time (e.g. 16:30 after class).
          </Text>
          {!from?.trim() ? (
            <TextInput
              style={styles.input}
              placeholder="Pickup location"
              placeholderTextColor="#9ca3af"
              value={manualLocation}
              onChangeText={setManualLocation}
            />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor="#9ca3af"
            value={manualTime}
            onChangeText={setManualTime}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!manualTime.trim() || (!from?.trim() && !manualLocation.trim())) && styles.continueButtonDisabled,
            ]}
            onPress={handleManualContinue}
            disabled={!manualTime.trim() || (!from?.trim() && !manualLocation.trim())}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : !connectError ? (
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
      ) : null}

      {/* Cancel */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
          <Text style={styles.cancelBtnText}>Cancel Request</Text>
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

  body: { flex: 1, padding: 24, gap: 20 },

  // Status
  statusCenter: { alignItems: "center", gap: 12, paddingTop: 16 },
  pulseWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  pulseRing1: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(26,58,107,0.10)",
  },
  pulseRing2: {
    position: "absolute", width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(26,58,107,0.06)",
  },
  statusCircle: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#1a3a6b", shadowOpacity: 0.25,
    shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  statusCircleSearching: { backgroundColor: "#1a3a6b" },
  statusCircleConnecting: { backgroundColor: "#94a3b8" },
  statusTitle: { fontSize: 20, fontWeight: "800", color: "#0a1628", letterSpacing: -0.3 },
  statusSub: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20, maxWidth: 280 },

  // Trip card
  tripCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  tripRow: { flexDirection: "row", gap: 14, paddingVertical: 8 },
  tripDotWrap: { width: 20, alignItems: "center", paddingTop: 3 },
  tripDotFilled: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#1a3a6b" },
  tripLine: {
    width: 2, flex: 1, backgroundColor: "#e2e8f0",
    marginTop: 4, marginBottom: -8, minHeight: 24,
  },
  tripDotOutline: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: "#1a3a6b",
  },
  tripInfo: { flex: 1 },
  tripLabel: { fontSize: 11, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  tripValue: { fontSize: 15, fontWeight: "700", color: "#0a1628", marginTop: 2 },

  // Tip
  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#f0f4ff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#c7d7fd",
  },
  tipText: { flex: 1, fontSize: 12, color: "#3b4e7a", lineHeight: 18 },

  // Footer / cancel
  footer: { padding: 20, paddingBottom: 36 },
  cancelBtn: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#f1f5f9", borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  cancelBtnText: { fontSize: 16, fontWeight: "700", color: "#64748b" },

  // Manual time entry / error handling
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { fontSize: 15, color: "#1a3a6b", fontWeight: "600" },
  statusConnecting: { fontSize: 15, color: "#9ca3af" },
  manualBox: { gap: 12, marginTop: 8 },
  manualTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  manualHint: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  continueButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fcd34d",
    gap: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, color: "#92400e", lineHeight: 20 },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#1a3a6b",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  retryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
