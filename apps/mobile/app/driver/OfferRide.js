import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";



const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      const today = getCurrentWeekday();
      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");

      let residence = null;
      try {
        const userRes = await fetch(
          `${SUPABASE_URL}/rest/v1/User?id=eq.${user.id}&select=residence`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        const userData = await userRes.json();
        residence = userData?.[0]?.residence ?? null;
      } catch (_) {}

      if (normalizedBackendUrl) {
        try {
          const res = await fetch(`${normalizedBackendUrl}/api/driver/schedule`, {
            headers: { "x-user-id": user.id },
          });
          if (res.ok) {
            const body = await res.json();
            const days = body.days;
            const todaySchedule = days?.[today];
            const startTime = todaySchedule?.start_time ?? null;
            const endTime = todaySchedule?.end_time ?? null;

            setFrom(residence);
            setClassStart(startTime);
            setClassEnd(endTime);
            setPickupTime(startTime ? subtractMinutes(startTime, 15) : "");
            return;
          }
        } catch (_) {
          // fall through to Supabase fallback
        }
      }

      const scheduleRes = await fetch(
        `${SUPABASE_URL}/rest/v1/schedule?user_id=eq.${user.id}&select=days`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        },
      );

      const scheduleData = await scheduleRes.json();

      const row = scheduleData?.[0];
      const days = row?.days;
      const todaySchedule = days?.[today];
      const startTime = todaySchedule?.start_time ?? null;
      const endTime = todaySchedule?.end_time ?? null;

      setFrom(residence);
      setClassStart(startTime);
      setClassEnd(endTime);
      setPickupTime(startTime ? subtractMinutes(startTime, 15) : "");
    } catch (_) {
      // leave defaults blank
    } finally {
      setLoading(false);
    }
  }

  function handleOffer() {
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
    <View style={styles.container}>
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

      <Text style={styles.header}>Offer a Ride</Text>

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
            style={styles.input}
            value={pickupTime}
            onChangeText={setPickupTime}
            placeholder="HH:MM"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.offerButton}
        onPress={handleOffer}
        activeOpacity={0.8}
      >
        <Text style={styles.offerButtonText}>Offer Ride</Text>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f6f1",
    padding: 24,
    gap: 12,
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
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 24,
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
    marginBottom: 32,
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
    maxWidth: "60%",
    textAlign: "right",
  },
  input: {
    fontSize: 15,
    color: "#1a3a6b",
    fontWeight: "600",
    textAlign: "right",
    minWidth: 70,
    borderBottomWidth: 1,
    borderBottomColor: "#1a3a6b",
    paddingBottom: 2,
  },
  offerButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  offerButtonDisabled: {
    opacity: 0.6,
  },
  offerButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
  },
  successSub: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
  },
});
