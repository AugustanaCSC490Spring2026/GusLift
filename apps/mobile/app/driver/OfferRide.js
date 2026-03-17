import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
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
function getCurrentWeekday() { return WEEKDAYS[new Date().getUTCDay()]; }

function subtractMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m - minutes;
  const clipped = Math.max(0, total);
  return `${String(Math.floor(clipped / 60)).padStart(2, "0")}:${String(clipped % 60).padStart(2, "0")}`;
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

  useEffect(() => { loadSchedule(); }, []);

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
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  }

  function handleOffer() {
    router.push({
      pathname: "/driver/DriverWaitingRoom",
      params: { from: from ?? "", pickupTime, classStart: classStart ?? "", classEnd: classEnd ?? "" },
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
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/home");
              }
            }}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offer a Ride</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.headerSub}>Today's trip details</Text>
      </View>

      {/* Trip card */}
      <View style={styles.body}>
        <View style={styles.tripCard}>
          {/* From */}
          <View style={styles.tripRow}>
            <View style={styles.tripDotWrap}>
              <View style={styles.tripDotFilled} />
              <View style={styles.tripLine} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripRowLabel}>Pickup from</Text>
              <Text style={styles.tripRowValue}>{from ?? "—"}</Text>
            </View>
          </View>

          {/* To */}
          <View style={styles.tripRow}>
            <View style={styles.tripDotWrap}>
              <View style={styles.tripDotOutline} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripRowLabel}>Drop off at</Text>
              <Text style={styles.tripRowValue}>Augustana College</Text>
            </View>
          </View>
        </View>

        {/* Times card */}
        <View style={styles.timesCard}>
          <View style={styles.timeRow}>
            <View style={styles.timeIconWrap}>
              <Ionicons name="school-outline" size={18} color="#1a3a6b" />
            </View>
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Class window</Text>
              <Text style={styles.timeValue}>
                {formatTime12h(classStart)} → {formatTime12h(classEnd)}
              </Text>
            </View>
          </View>

          <View style={styles.timeDivider} />

          <View style={styles.timeRow}>
            <View style={styles.timeIconWrap}>
              <Ionicons name="time-outline" size={18} color="#1a3a6b" />
            </View>
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Pick up riders at</Text>
              <TextInput
                style={styles.timeInput}
                value={pickupTime}
                onChangeText={setPickupTime}
                placeholder="HH:MM"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <Text style={styles.editHint}>Edit</Text>
          </View>
        </View>

        {/* Info note */}
        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={15} color="#64748b" />
          <Text style={styles.noteText}>
            Riders will be matched based on your location and pickup time.
          </Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.offerBtn} onPress={handleOffer} activeOpacity={0.88}>
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.offerBtnText}>Offer Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f5f0" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f5f0" },

  // Header
  header: {
    backgroundColor: "#0f1f3d", paddingTop: 56,
    paddingHorizontal: 20, paddingBottom: 24, gap: 4, overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 },

  // Body
  body: { flex: 1, padding: 20, gap: 14 },

  // Trip card (Uber-style vertical line)
  tripCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 0,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  tripRow: { flexDirection: "row", gap: 14, paddingVertical: 10 },
  tripDotWrap: { width: 20, alignItems: "center", paddingTop: 3 },
  tripDotFilled: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: "#1a3a6b",
  },
  tripLine: {
    width: 2, flex: 1, backgroundColor: "#e2e8f0",
    marginTop: 4, marginBottom: -10, minHeight: 28,
  },
  tripDotOutline: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: "#1a3a6b",
  },
  tripInfo: { flex: 1, gap: 2 },
  tripRowLabel: { fontSize: 11, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  tripRowValue: { fontSize: 16, fontWeight: "700", color: "#0a1628" },

  // Times card
  timesCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  timeIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center",
  },
  timeInfo: { flex: 1 },
  timeLabel: { fontSize: 11, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  timeValue: { fontSize: 16, fontWeight: "700", color: "#0a1628", marginTop: 2 },
  timeInput: {
    fontSize: 16, fontWeight: "700", color: "#1a3a6b", marginTop: 2,
    borderBottomWidth: 1.5, borderBottomColor: "#1a3a6b", paddingBottom: 2,
  },
  editHint: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  timeDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 14 },

  // Note
  noteRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#f8faff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e0e8ff",
  },
  noteText: { flex: 1, fontSize: 12, color: "#64748b", lineHeight: 18 },

  // Footer
  footer: { padding: 20, paddingBottom: 36 },
  offerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1a3a6b", borderRadius: 16, paddingVertical: 17, gap: 10,
    shadowColor: "#1a3a6b", shadowOpacity: 0.35, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 7,
  },
  offerBtnText: { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
});
