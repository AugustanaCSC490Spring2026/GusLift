import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function getCurrentWeekday() {
  return WEEKDAYS[new Date().getUTCDay()];
}

function subtractMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m - minutes;
  const clipped = Math.max(0, total);
  const hh = String(Math.floor(clipped / 60)).padStart(2, "0");
  const mm = String(clipped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function OfferRide() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  /** Driver pickup label = User.residence (same slot location the worker uses). */
  const [from, setFrom] = useState(null);
  const [classStart, setClassStart] = useState(null);
  const [classEnd, setClassEnd] = useState(null);
  const [pickupTime, setPickupTime] = useState("");
  const [firstName, setFirstName] = useState("");

  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualFieldError, setManualFieldError] = useState(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    if (loading) return;
    const seed = (from && String(from).trim()) || "";
    setManualPickup((prev) => (prev.trim() ? prev : seed));
  }, [loading, from]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setFirstName(user.given_name || (user.name ? user.name.split(" ")[0] : ""));
      const today = getCurrentWeekday();
      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");
      if (!normalizedBackendUrl) {
        setFrom(null);
        setClassStart(null);
        setClassEnd(null);
        setPickupTime("");
        return;
      }

      const res = await fetch(`${normalizedBackendUrl}/api/driver/schedule`, {
        headers: { "x-user-id": user.id },
      });

      if (!res.ok) {
        setFrom(null);
        setClassStart(null);
        setClassEnd(null);
        setPickupTime("");
        return;
      }

      const body = await res.json();
      const days = body.days;
      const resolvedFrom = body.from ?? body.pickup_loc ?? body.residence ?? null;
      const todaySchedule = days?.[today];
      const startTime = todaySchedule?.start_time ?? null;
      const endTime = todaySchedule?.end_time ?? null;

      setFrom(resolvedFrom);
      setClassStart(startTime);
      setClassEnd(endTime);
      setPickupTime(startTime ? subtractMinutes(startTime, 15) : "");
    } catch (_) {
      // leave defaults blank
    } finally {
      setLoading(false);
    }
  }

  function validateManual() {
    const pickup = manualPickup.trim();
    const time = manualTime.trim();
    if (!pickup) {
      setManualFieldError("Enter where you are picking up.");
      return null;
    }
    if (!TIME_RE.test(time)) {
      setManualFieldError("Use 24-hour time like 14:30 or 08:15.");
      return null;
    }
    setManualFieldError(null);
    return { pickup, time };
  }

  function handleManualOffer() {
    const v = validateManual();
    if (!v) return;
    router.push({
      pathname: "/driver/DriverWaitingRoom",
      params: {
        from: v.pickup,
        to: manualDropoff.trim() || "",
        time: v.time,
        matchMode: "manual",
      },
    });
  }

  function handleScheduleOffer() {
    router.push({
      pathname: "/driver/DriverWaitingRoom",
      params: {
        from: from ?? "",
        pickupTime,
        classStart: classStart ?? "",
        classEnd: classEnd ?? "",
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
    <View style={styles.outer}>
      {/* X button top left */}
      <TouchableOpacity
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/home");
          }
        }}
        style={styles.closeButton}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {firstName ? (
          <Text style={styles.greeting}>Hello {firstName}, where are you heading today?</Text>
        ) : null}
        <Text style={styles.header}>Offer a Ride</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom ride offer</Text>
          <Text style={styles.sectionSub}>
            Use this to offer a ride outside of your normal commute, or at a specific time.
          </Text>

          <Text style={styles.fieldLabel}>Pickup location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Off-campus house, Augie Hall"
            placeholderTextColor="#9ca3af"
            value={manualPickup}
            onChangeText={(t) => {
              setManualPickup(t);
              if (manualFieldError) setManualFieldError(null);
            }}
          />

          <Text style={styles.fieldLabel}>Going to (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Shown for the rider's reference"
            placeholderTextColor="#9ca3af"
            value={manualDropoff}
            onChangeText={setManualDropoff}
          />

          <Text style={styles.fieldLabel}>Pickup time (24h)</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM — e.g. 08:30"
            placeholderTextColor="#9ca3af"
            value={manualTime}
            onChangeText={(t) => {
              setManualTime(t);
              if (manualFieldError) setManualFieldError(null);
            }}
            keyboardType="numbers-and-punctuation"
          />

          {manualFieldError ? <Text style={styles.fieldError}>{manualFieldError}</Text> : null}

          <TouchableOpacity style={styles.manualButton} onPress={handleManualOffer} activeOpacity={0.8}>
            <Text style={styles.manualButtonText}>Offer with this time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.orRule}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or match using your schedule</Text>
          <View style={styles.orLine} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleMuted}>Today’s saved route</Text>
          <View style={styles.card}>
            {/* From */}
            <View style={styles.row}>
              <Text style={styles.label}>From</Text>
              <Text style={styles.value}>{from ?? "—"}</Text>
            </View>
            <View style={styles.divider} />

            {/* Class Starts */}
            <View style={styles.row}>
              <Text style={styles.label}>Class Starts</Text>
              <Text style={styles.value}>{formatTime12h(classStart)}</Text>
            </View>
            <View style={styles.divider} />

            {/* Class End */}
            <View style={styles.row}>
              <Text style={styles.label}>Class End</Text>
              <Text style={styles.value}>{formatTime12h(classEnd)}</Text>
            </View>
            <View style={styles.divider} />

            {/* Pick Up Time — editable */}
            <View style={styles.row}>
              <Text style={styles.label}>Pick Up Time</Text>
              <TextInput
                style={styles.timeInput}
                value={pickupTime}
                onChangeText={setPickupTime}
                placeholder="HH:MM"
                placeholderTextColor="#9ca3af"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={handleScheduleOffer}
            activeOpacity={0.8}
          >
            <Text style={styles.scheduleButtonText}>Offer using schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
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
    marginVertical: 12, // changed from marginBottom 12 to center more cleanly but sticking to original mostly
    alignSelf: "flex-start",
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
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  sectionTitleMuted: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 6,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 13,
    color: "#b45309",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 4,
  },
  manualButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  manualButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  orRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 28,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d1d5db",
  },
  orText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
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
    marginBottom: 16,
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
    maxWidth: "58%",
    textAlign: "right",
  },
  timeInput: {
    fontSize: 15,
    color: "#1a3a6b",
    fontWeight: "600",
    textAlign: "right",
    minWidth: 70,
    borderBottomWidth: 1,
    borderBottomColor: "#1a3a6b",
    paddingBottom: 2,
  },
  scheduleButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1a3a6b",
  },
  scheduleButtonText: {
    color: "#1a3a6b",
    fontSize: 17,
    fontWeight: "700",
  },
});
