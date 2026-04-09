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

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    async function setup() {
      setConnectError(null);
      // MatchingContext.connect: GET preflight → WebSocket; may return needsManualTime without opening a socket.
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
    marginBottom: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  label: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
  value: { fontSize: 15, color: "#1f2937", fontWeight: "600", maxWidth: "60%", textAlign: "right" },
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
