import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
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

function subtractMinutes(timeStr, minutes) {
  if (!timeStr || !TIME_RE.test(String(timeStr).trim())) return "";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const total = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
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

  // For both modes pickup is always 15 minutes before class start. For manual
  // mode the user types in the class start time directly; for schedule mode
  // OfferRide/DriverHome pass the class start (and a pre-derived pickup, but
  // we recompute here so the source of truth stays in one place).
  const effectiveClassStart = isManualEntry ? time : classStart;
  const effectivePickup = effectiveClassStart
    ? subtractMinutes(effectiveClassStart, 15)
    : pickupTime;

  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let unsubscribe;

    async function setup() {
      const result = isManualEntry
        ? await connect({ location: from, time })
        : await connect();

      if (result?.ok && result.userId) {
        const tripTo = String(to ?? "").trim();
        send({
          type: "driver_online",
          driver_id: result.userId,
          ...(tripTo ? { to_location: tripTo } : {}),
        });
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
              pickupTime: effectivePickup,
              classStart: effectiveClassStart,
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.summaryValue}>{formatTime12h(effectivePickup)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Class starts</Text>
          <Text style={styles.summaryValue}>
            {formatTime12h(effectiveClassStart)}
          </Text>
        </View>
        {!isManualEntry && classEnd ? (
          <>
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
            <ActivityIndicator size="small" color="#3B82F6" />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
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
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
  offlineChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  offlineChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  heroCard: {
    backgroundColor: "#3B82F6",
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.8)",
  },
  heroTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.7,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.85)",
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
    backgroundColor: "rgba(255,255,255,0.2)",
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
    color: "#FFFFFF",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
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
    color: "#64748B",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  signalCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  signalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  signalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
