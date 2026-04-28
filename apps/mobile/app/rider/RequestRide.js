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

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function minusMinutes(timeStr, minutesToSubtract) {
  if (!TIME_RE.test(String(timeStr || "").trim())) return null;
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const total = h * 60 + m - minutesToSubtract;
  if (total < 0) return null;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatTime12h(timeStr) {
  if (!TIME_RE.test(String(timeStr || "").trim())) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function buildWaitingRoomReturnPath(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    searchParams.set(key, normalized);
  });
  const query = searchParams.toString();
  return `/rider/RiderWaitingRoom${query ? `?${query}` : ""}`;
}

export default function RequestRide() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropoffLoc, setDropoffLoc] = useState(null);
  const [residence, setResidence] = useState(null);
  const [schedulePickupTime, setSchedulePickupTime] = useState(null);
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
    const seed =
      (pickupLoc && String(pickupLoc).trim()) ||
      (residence && String(residence).trim()) ||
      "";
    setManualPickup((prev) => (prev.trim() ? prev : seed));
  }, [loading, pickupLoc, residence]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setFirstName(user.given_name || (user.name ? user.name.split(" ")[0] : ""));
      if (!BACKEND_URL || !user?.id) return;

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const scheduleRes = await fetch(
        `${normalizedBackendUrl}/api/rider/schedule?userID=${encodeURIComponent(String(user.id))}`,
        { headers: { "x-user-id": String(user.id) } }
      );
      if (!scheduleRes.ok) return;

      const scheduleData = await scheduleRes.json();
      setPickupLoc(scheduleData?.pickup_loc ?? null);
      setDropoffLoc(scheduleData?.dropoff_loc ?? null);
      setResidence(scheduleData?.residence ?? null);
      const todayKey = DAY_KEYS[new Date().getDay()];
      const firstClassStart = scheduleData?.days?.[todayKey]?.start_time ?? null;
      setSchedulePickupTime(minusMinutes(firstClassStart, 15));
    } catch (_) {
      // leave blank
    } finally {
      setLoading(false);
    }
  }

  function validateManual() {
    const pickup = manualPickup.trim();
    const time = manualTime.trim();
    if (!pickup) {
      setManualFieldError("Enter where you want to be picked up (e.g. campus building or residence).");
      return null;
    }
    if (!TIME_RE.test(time)) {
      setManualFieldError("Use 24-hour time like 14:30 or 08:15.");
      return null;
    }
    setManualFieldError(null);
    return { pickup, time };
  }

  function handleManualRequest() {
    const v = validateManual();
    if (!v) return;
    const destination = (manualDropoff.trim() || dropoffLoc || "").trim();
    router.push({
      pathname: "/payments/demo",
      params: {
        paymentStage: "request",
        rideLabel: "Ride request payment",
        returnPath: buildWaitingRoomReturnPath({
          from: v.pickup,
          to: destination,
          time: v.time,
          matchMode: "manual",
        }),
      },
    });
  }

  function handleScheduleRequest() {
    router.push({
      pathname: "/payments/demo",
      params: {
        paymentStage: "request",
        rideLabel: "Ride request payment",
        returnPath: buildWaitingRoomReturnPath({
          from: pickupLoc ?? "",
          to: dropoffLoc ?? "",
          matchMode: "schedule",
          ...(schedulePickupTime ? { time: schedulePickupTime } : {}),
        }),
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <TouchableOpacity
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/");
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
          <Text style={styles.greeting}>Hello {firstName}, where would you like to go today?</Text>
        ) : null}
        <Text style={styles.header}>Request a Ride</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom pickup time</Text>
          <Text style={styles.sectionSub}>
            Use this when you are leaving class, heading home, or your ride is not covered by today’s
            first class start on your schedule.
          </Text>

          <Text style={styles.fieldLabel}>Pickup location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Augie Hall, library, your dorm"
            placeholderTextColor="#94A3B8"
            value={manualPickup}
            onChangeText={(t) => {
              setManualPickup(t);
              if (manualFieldError) setManualFieldError(null);
            }}
          />

          <Text style={styles.fieldLabel}>Going to (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Shown for your reference only"
            placeholderTextColor="#94A3B8"
            value={manualDropoff}
            onChangeText={setManualDropoff}
          />

          <Text style={styles.fieldLabel}>Pickup time (24h)</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM — e.g. 16:45 after class"
            placeholderTextColor="#94A3B8"
            value={manualTime}
            onChangeText={(t) => {
              setManualTime(t);
              if (manualFieldError) setManualFieldError(null);
            }}
            keyboardType="numbers-and-punctuation"
          />

          {manualFieldError ? <Text style={styles.fieldError}>{manualFieldError}</Text> : null}

          <TouchableOpacity style={styles.manualButton} onPress={handleManualRequest} activeOpacity={0.8}>
            <Text style={styles.manualButtonText}>Request with this time</Text>
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
              <Text style={styles.value}>
                {schedulePickupTime ? `${formatTime12h(schedulePickupTime)} (15 min before class)` : "—"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.scheduleButton} onPress={handleScheduleRequest} activeOpacity={0.8}>
            <Text style={styles.scheduleButtonText}>Request using schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  closeText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  sectionTitleMuted: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 4,
  },
  manualButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  manualButtonText: {
    color: "#FFFFFF",
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
    backgroundColor: "#CBD5E1",
  },
  orText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
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
    backgroundColor: "#E2E8F0",
  },
  label: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  value: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
    maxWidth: "58%",
    textAlign: "right",
  },
  scheduleButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  scheduleButtonText: {
    color: "#3B82F6",
    fontSize: 17,
    fontWeight: "700",
  },
});
