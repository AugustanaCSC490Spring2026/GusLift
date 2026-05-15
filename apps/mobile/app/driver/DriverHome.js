import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AutocompleteInput from "../../components/setup/AutocompleteInput";
import TimePickerField from "../../components/setup/TimePickerField";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function getCurrentWeekday() {
  return WEEKDAYS[new Date().getUTCDay()];
}

function subtractMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m - minutes;
  const clipped = Math.max(0, total);
  return `${String(Math.floor(clipped / 60)).padStart(2, "0")}:${String(
    clipped % 60,
  ).padStart(2, "0")}`;
}

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  if (isNaN(h)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

function groupRides(rides) {
  const grouped = new Map();
  for (const ride of rides) {
    const key = `${ride.day}|${ride.start_time}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        day: ride.day,
        start_time: ride.start_time,
        pickup_loc: ride.pickup_loc ?? ride.location ?? null,
        dropoff_loc: ride.dropoff_loc ?? null,
        riders: [],
        rideIds: [],
      });
    }
    const entry = grouped.get(key);
    entry.riders.push(ride.rider);
    if (ride.id != null) entry.rideIds.push(String(ride.id));
  }
  return Array.from(grouped.values()).sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
  );
}

function getInitial(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "D";
}

export default function DriverHome() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [pictureUrl, setPictureUrl] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [from, setFrom] = useState(null);
  const [residence, setResidence] = useState(null);
  const [classStart, setClassStart] = useState(null);
  const [classEnd, setClassEnd] = useState(null);
  const [pickupTime, setPickupTime] = useState("");
  const [schedulePickup, setSchedulePickup] = useState("");
  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualFieldError, setManualFieldError] = useState(null);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [completingKey, setCompletingKey] = useState(null);

  useEffect(() => {
    loadSchedule();
    loadRides();
  }, []);

  useEffect(() => {
    if (scheduleLoading) return;
    const seed =
      (from && String(from).trim()) ||
      (residence && String(residence).trim()) ||
      "";
    setSchedulePickup((prev) => (prev.trim() ? prev : seed));
    setManualPickup((prev) => (prev.trim() ? prev : seed));
  }, [scheduleLoading, from, residence]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setFirstName(
        user.given_name || (user.name ? user.name.split(" ")[0] : ""),
      );

      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");

      const [scheduleRes, userRes] = await Promise.all([
        normalizedBackendUrl
          ? fetch(`${normalizedBackendUrl}/api/driver/schedule`, {
              headers: { "x-user-id": user.id },
            })
          : Promise.resolve(null),
        fetch(`${SUPABASE_URL}/rest/v1/User?id=eq.${user.id}&select=residence,picture_url`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }),
      ]);

      const userData = await userRes.json();
      const userResidence = userData?.[0]?.residence ?? null;
      if (userData?.[0]?.picture_url) setPictureUrl(userData[0].picture_url);
      setResidence(userResidence);

      if (scheduleRes?.ok) {
        const body = await scheduleRes.json();
        const today = getCurrentWeekday();
        const resolvedFrom = body.from ?? body.pickup_loc ?? body.residence ?? userResidence ?? null;
        const todaySchedule = body.days?.[today];

        if (body.picture_url) setPictureUrl(body.picture_url);
        setFrom(resolvedFrom);
        setClassStart(todaySchedule?.start_time ?? null);
        setClassEnd(todaySchedule?.end_time ?? null);
      }
    } catch (_) {
      // Keep the dashboard usable even if schedule fetch fails.
    } finally {
      setScheduleLoading(false);
    }
  }

  async function loadRides() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");
      if (!normalizedBackendUrl) {
        setGroups([]);
        return;
      }

      const res = await fetch(
        `${normalizedBackendUrl}/api/driver/rides?driver_id=${encodeURIComponent(
          user.id,
        )}`,
      );
      if (!res.ok) {
        setGroups([]);
        return;
      }

      const payload = await res.json();
      const rides = payload?.rides ?? [];
      setGroups(rides.length ? groupRides(rides) : []);
    } catch (_) {
      setGroups([]);
    } finally {
      setRidesLoading(false);
    }
  }

  async function completeRides(groupKey, rideIds) {
    if (!rideIds?.length || completingKey) return;
    const stored = await AsyncStorage.getItem("@user");
    if (!stored || !BACKEND_URL) return;
    const user = JSON.parse(stored);
    setCompletingKey(groupKey);
    try {
      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${normalizedBackendUrl}/api/driver/rides`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({ ride_ids: rideIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(
          "Could not complete ride",
          payload?.error || "Try again.",
        );
        return;
      }
      await loadRides();
    } catch {
      Alert.alert("Error", "Could not complete ride. Try again.");
    } finally {
      setCompletingKey(null);
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
    const validated = validateManual();
    if (!validated) return;
    router.push({
      pathname: "/driver/DriverWaitingRoom",
      params: {
        from: validated.pickup,
        to: manualDropoff.trim() || "",
        time: validated.time,
        matchMode: "manual",
      },
    });
  }

  function handleScheduleOffer() {
    router.push({
      pathname: "/driver/DriverWaitingRoom",
      params: {
        from: schedulePickup.trim() || (from ?? ""),
        pickupTime,
        classStart: classStart ?? "",
        classEnd: classEnd ?? "",
      },
    });
  }

  const previewGroups = groups.slice(0, 3);
  const nextGroup = groups[0] ?? null;
  const seatsBooked = groups.reduce(
    (total, group) => total + group.riders.length,
    0,
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              {pictureUrl ? (
                <Image source={{ uri: pictureUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitial(firstName)}</Text>
              )}
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroTitle}>Hello, {firstName || "Driver"}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Driver mode</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroSummary}>
            {nextGroup
              ? `Next ride ${DAY_LABELS[nextGroup.day] ?? nextGroup.day} at ${formatTime12h(
                  nextGroup.start_time,
                )} with ${nextGroup.riders.length} rider${
                  nextGroup.riders.length === 1 ? "" : "s"
                }.`
              : "Post a ride using your schedule or create a custom pickup for one-off trips."}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Upcoming slots</Text>
              <Text style={styles.metricValue}>{groups.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Booked riders</Text>
              <Text style={styles.metricValue}>{seatsBooked}</Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <Pressable
              style={({ hovered, pressed }) => [
                styles.heroPrimaryAction,
                hovered && styles.heroActionHovered,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => router.push("/driver/ScheduledRidesDriver")}
            >
              <Text style={styles.heroPrimaryActionText}>View upcoming rides</Text>
            </Pressable>
            <Pressable
              style={({ hovered, pressed }) => [
                styles.heroSecondaryAction,
                hovered && styles.heroActionHovered,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => router.push("/driver/ManageSchedule")}
            >
              <Text style={styles.heroSecondaryActionText}>Change schedule</Text>
            </Pressable>
          </View>

        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Offer flow</Text>
          <Text style={styles.sectionTitle}>Go live as a driver</Text>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardEyebrow}>Saved commute</Text>
              <Text style={styles.cardTitle}>Use your default route for today</Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <AutocompleteInput
            style={styles.input}
            placeholder="Off-campus house, Westerlin, library"
            placeholderTextColor="#8a93a5"
            value={schedulePickup}
            onChangeText={setSchedulePickup}
          />

          {scheduleLoading ? (
            <ActivityIndicator
              size="small"
              color="#3B82F6"
              style={styles.inlineLoader}
            />
          ) : (
            <>
              <Text style={styles.inputLabel}>Class starts</Text>
              <View style={styles.inputDisplay}>
                <Text style={styles.inputDisplayText}>{formatTime12h(classStart)}</Text>
              </View>

              <Text style={styles.inputLabel}>Class ends</Text>
              <View style={styles.inputDisplay}>
                <Text style={styles.inputDisplayText}>{formatTime12h(classEnd)}</Text>
              </View>

              <Text style={styles.inputLabel}>Pickup time</Text>
              <TimePickerField
                value={pickupTime}
                onChange={setPickupTime}
                placeholder="Select a pick up time"
              />

              <Text style={styles.helperText}>
                This opens a driver waiting room using your default pickup point and today&apos;s
                class window.
              </Text>
            </>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleScheduleOffer}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Offer using schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.manualCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardEyebrow}>One-off offer</Text>
              <Text style={styles.cardTitle}>Create a custom pickup window</Text>
            </View>
          </View>

          <Text style={styles.cardDescription}>
            Use this when you are driving outside your normal routine or want to post a ride
            at a specific time.
          </Text>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <AutocompleteInput
            style={styles.input}
            placeholder="Off-campus house, Westerlin, library"
            placeholderTextColor="#8a93a5"
            value={manualPickup}
            onChangeText={(value) => {
              setManualPickup(value);
              if (manualFieldError) setManualFieldError(null);
            }}
          />

          <Text style={styles.inputLabel}>Going to</Text>
          <AutocompleteInput
            style={styles.input}
            placeholder="Optional destination for rider context"
            placeholderTextColor="#8a93a5"
            value={manualDropoff}
            onChangeText={setManualDropoff}
          />

          <Text style={styles.inputLabel}>Pickup time</Text>
          <TimePickerField
            value={manualTime}
            onChange={(value) => {
              setManualTime(value);
              if (manualFieldError) setManualFieldError(null);
            }}
            placeholder="Select a pick up time"
          />

          {manualFieldError ? (
            <Text style={styles.fieldError}>{manualFieldError}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleManualOffer}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Offer with custom time</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 40,
    gap: 18,
  },
  heroCard: {
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    padding: 16,
    overflow: "hidden",
    gap: 10,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#FFFFFF",
    top: -68,
    right: -24,
    opacity: 0.2,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#FFFFFF",
    bottom: -56,
    left: -24,
    opacity: 0.1,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  heroIdentity: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#d4e2f5",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
  },
  heroSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: "#d7e2f1",
    maxWidth: "94%",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#d2def0",
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrimaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3B82F6",
  },
  heroSecondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSecondaryActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroActionHovered: {
    transform: [{ translateY: -2 }],
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  sectionHeader: {
    gap: 4,
    marginTop: 6,
  },
  sectionHeaderCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#64748B",
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  scheduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  manualCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#64748B",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 26,
    maxWidth: 240,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeWarm: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  routePanel: {
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 16,
  },
  routeDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  routeValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  inlineTimeInput: {
    minWidth: 84,
    borderBottomWidth: 1.5,
    borderBottomColor: "#3B82F6",
    textAlign: "right",
    paddingBottom: 2,
    fontSize: 15,
    fontWeight: "700",
    color: "#3B82F6",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#64748B",
    marginTop: 4,
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
  inputDisplay: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: "center",
  },
  inputDisplayText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  fieldError: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  inlineLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },
  inlineLoader: {
    marginVertical: 12,
  },
  emptyState: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  rideShell: {
    gap: 10,
  },
  rideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 14,
  },
  rideCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rideDay: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  rideTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  routeTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  routeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  routeTagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  riderStrip: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 14,
  },
  riderStripLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  riderChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  riderChip: {
    borderRadius: 999,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  riderChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
  },
  riderChipMuted: {
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  riderChipMutedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  completeButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completeButtonDisabled: {
    opacity: 0.7,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
