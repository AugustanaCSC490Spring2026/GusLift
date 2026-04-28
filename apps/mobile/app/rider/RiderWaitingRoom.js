import { useMatching } from "../../context/MatchingContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const matchMode = Array.isArray(params.matchMode)
    ? params.matchMode[0]
    : params.matchMode;
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

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    async function setup() {
      setConnectError(null);
      unsubscribe = onMessage((msg) => {
        if (msg.type === "match_request") {
          const driverCar = msg.driver?.car
            ? [
                [
                  msg.driver.car.color,
                  msg.driver.car.make,
                  msg.driver.car.model,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
                msg.driver.car.license_plate,
              ]
                .filter(Boolean)
                .join(" · ")
            : "";
          router.replace({
            pathname: "/rider/AvailableDrivers",
            params: {
              from,
              to,
              driverId: msg.driver_id,
              driverName: msg.driver?.name ?? "",
              driverPic: msg.driver?.picture_url ?? "",
              driverTo: msg.driver?.to_location ?? "",
              driverCar,
            },
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
  }, [connect, from, isManualEntry, onMessage, router, send, timeParam, to]);

  async function handleManualContinue() {
    setConnectError(null);
    const loc = (manualLocation || from || "").trim();
    const time = manualTime.trim();
    if (!loc || !TIME_RE.test(time)) return;

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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  function handleUseDemoDriver() {
    router.replace({
      pathname: "/rider/AvailableDrivers",
      params: {
        from,
        to,
        driverId: "demo-driver",
        driverName: "Demo Driver",
        driverPic: "",
        driverTo: to || "Campus",
        driverCar: "Blue Toyota Corolla · DEMO",
        demoMode: "true",
      },
    });
  }

  const effectiveSlotTime =
    isManualEntry && timeParam
      ? String(timeParam).trim()
      : manualTime.trim() && TIME_RE.test(manualTime.trim())
        ? manualTime.trim()
        : null;

  const statusLabel = connectError
    ? "Connection issue"
    : needsManualTime
      ? "Need a time"
      : connected
        ? "Searching live"
        : "Connecting";

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelChip}
          activeOpacity={0.82}
        >
          <Text style={styles.cancelChipText}>Cancel request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>Rider queue</Text>
        <Text style={styles.heroTitle}>Ride request in progress</Text>
        <Text style={styles.heroBody}>
          We are matching you with a driver using your route details below.
        </Text>

        <View style={styles.statusPill}>
          {connected && !needsManualTime && !connectError ? (
            <View style={styles.liveDot} />
          ) : (
            <IoniconsProxy name={connectError ? "alert" : "time"} />
          )}
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Trip summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>From</Text>
          <Text style={styles.summaryValue}>{from || "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To</Text>
          <Text style={styles.summaryValue}>{to || "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pickup time</Text>
          <Text style={styles.summaryValue}>
            {effectiveSlotTime
              ? formatTime12h(effectiveSlotTime)
              : needsManualTime
                ? "Enter below"
                : matchMode !== "manual" && !isManualEntry
                  ? "First class today"
                  : "—"}
          </Text>
        </View>
      </View>

      {connectError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to start matching</Text>
          <Text style={styles.errorText}>{connectError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.86}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleUseDemoDriver}
            activeOpacity={0.8}
          >
            <Text style={styles.demoButtonText}>Use demo driver instead</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {needsManualTime ? (
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>Add a one-off pickup time</Text>
          <Text style={styles.manualHint}>
            Your saved schedule did not provide a usable time for today, so matching needs a
            manual pickup window.
          </Text>
          {!from?.trim() ? (
            <TextInput
              style={styles.input}
              placeholder="Pickup location"
              placeholderTextColor="#94A3B8"
              value={manualLocation}
              onChangeText={setManualLocation}
            />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor="#94A3B8"
            value={manualTime}
            onChangeText={setManualTime}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!manualTime.trim() ||
                (!from?.trim() && !manualLocation.trim())) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleManualContinue}
            disabled={!manualTime.trim() || (!from?.trim() && !manualLocation.trim())}
            activeOpacity={0.86}
          >
            <Text style={styles.primaryButtonText}>Continue matching</Text>
          </TouchableOpacity>
        </View>
      ) : !connectError ? (
        <View style={styles.liveCard}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.liveTitle}>
            {connected ? "Looking for the best available driver" : "Connecting to matching"}
          </Text>
          <Text style={styles.liveBody}>
            Keep this screen open. As soon as a driver accepts, you will move straight to
            confirmation.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function IoniconsProxy({ name }) {
  return (
    <Text style={styles.statusIcon}>
      {name === "alert" ? "!" : "·"}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
  cancelChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  heroCard: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#EFF6FF",
    top: -60,
    right: -28,
    opacity: 0.45,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#DBEAFE",
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
    color: "#DBEAFE",
    maxWidth: "92%",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7dd38b",
  },
  statusIcon: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 14,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3B82F6",
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
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  retryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  manualCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 12,
  },
  manualTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#3B82F6",
    lineHeight: 26,
  },
  manualHint: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  liveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  liveTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3B82F6",
    textAlign: "center",
  },
  liveBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  demoButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  demoButtonText: { color: "#3B82F6", fontSize: 15, fontWeight: "700" },
});
