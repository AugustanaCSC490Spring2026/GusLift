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
  const matchMode = Array.isArray(params.matchMode)
    ? params.matchMode[0]
    : params.matchMode;
  const time = Array.isArray(params.time) ? params.time[0] : params.time;
  const pickupTime = Array.isArray(params.pickupTime)
    ? params.pickupTime[0]
    : params.pickupTime;
  const classStart = Array.isArray(params.classStart)
    ? params.classStart[0]
    : params.classStart;
  const classEnd = Array.isArray(params.classEnd)
    ? params.classEnd[0]
    : params.classEnd;

  const isManualEntry = matchMode === "manual";

  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let unsubscribe;

    async function setup() {
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
        const hasRiders =
          msg.type === "rider_joined" ||
          (msg.type === "initial_state" &&
            Array.isArray(msg.riders) &&
            msg.riders.length > 0);
        if (hasRiders) {
          router.replace({
            pathname: "/driver/AvailableRiders",
            params: {
              from,
              pickupTime: isManualEntry ? time : pickupTime,
              classStart,
              classEnd,
              to,
              matchMode,
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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  const statusLabel = connected
    ? "Live and waiting"
    : statusMessage
      ? "Offline"
      : "Connecting";

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleGoOffline}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleGoOffline}
          style={styles.offlineChip}
          activeOpacity={0.82}
        >
          <Text style={styles.offlineChipText}>Go offline</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>Driver queue</Text>
        <Text style={styles.heroTitle}>Ride offer is live</Text>
        <Text style={styles.heroBody}>
          Riders matching this pickup window will appear here as soon as the room receives
          activity.
        </Text>

        <View style={styles.statusPill}>
          {connected ? <View style={styles.liveDot} /> : null}
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Offer summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pickup point</Text>
          <Text style={styles.summaryValue}>{from || "—"}</Text>
        </View>
        {isManualEntry && to ? (
          <>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Destination</Text>
              <Text style={styles.summaryValue}>{to}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pickup time</Text>
          <Text style={styles.summaryValue}>
            {formatTime12h(isManualEntry ? time : pickupTime)}
          </Text>
        </View>
        {!isManualEntry ? (
          <>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class starts</Text>
              <Text style={styles.summaryValue}>{formatTime12h(classStart)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class ends</Text>
              <Text style={styles.summaryValue}>{formatTime12h(classEnd)}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.signalCard}>
        {connected ? (
          <>
            <ActivityIndicator size="small" color="#1a4a37" />
            <Text style={styles.signalTitle}>Listening for riders now</Text>
            <Text style={styles.signalBody}>
              The screen will automatically move you to the rider queue as soon as someone
              joins this offer.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.signalTitle}>Unable to go online</Text>
            <Text style={styles.signalBody}>
              {statusMessage || "Connecting to matching service."}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGoOffline}
        activeOpacity={0.86}
      >
        <Text style={styles.primaryButtonText}>
          {connected ? "Stop offering this ride" : "Leave this screen"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2efe7",
    paddingHorizontal: 20,
    paddingTop: 60,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#e6e0d2",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#44574e",
  },
  offlineChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#d8cebe",
  },
  offlineChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#44574e",
  },
  heroCard: {
    backgroundColor: "#1c4d38",
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#35644f",
    top: -58,
    right: -28,
    opacity: 0.46,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#d4e2da",
  },
  heroTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: "#fff9ef",
    letterSpacing: -0.7,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#d5e2d9",
    maxWidth: "93%",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 249, 239, 0.14)",
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7fd490",
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff9ef",
  },
  summaryCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e4dacb",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1c4d38",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6f8278",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#20352d",
  },
  divider: {
    height: 1,
    backgroundColor: "#ece3d6",
  },
  signalCard: {
    backgroundColor: "#fbf7ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e4dacb",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  signalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1c4d38",
    textAlign: "center",
  },
  signalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#647970",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#1c4d38",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 20,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff9ef",
  },
});
