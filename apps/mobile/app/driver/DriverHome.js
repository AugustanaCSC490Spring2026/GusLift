import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [from, setFrom] = useState(null);
  const [classStart, setClassStart] = useState(null);
  const [classEnd, setClassEnd] = useState(null);
  const [pickupTime, setPickupTime] = useState("");
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
    const seed = (from && String(from).trim()) || "";
    setManualPickup((prev) => (prev.trim() ? prev : seed));
  }, [scheduleLoading, from]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setFirstName(
        user.given_name || (user.name ? user.name.split(" ")[0] : ""),
      );

      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");
      if (!normalizedBackendUrl) return;

      const res = await fetch(`${normalizedBackendUrl}/api/driver/schedule`, {
        headers: { "x-user-id": user.id },
      });
      if (!res.ok) return;

      const body = await res.json();
      const today = getCurrentWeekday();
      const resolvedFrom = body.from ?? body.pickup_loc ?? body.residence ?? null;
      const todaySchedule = body.days?.[today];

      setFrom(resolvedFrom);
      setClassStart(todaySchedule?.start_time ?? null);
      setClassEnd(todaySchedule?.end_time ?? null);
      setPickupTime(
        todaySchedule?.start_time
          ? subtractMinutes(todaySchedule.start_time, 15)
          : "",
      );
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
        from: from ?? "",
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
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{getInitial(firstName)}</Text>
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.eyebrow}>Driver operations</Text>
              <Text style={styles.heroTitle}>Hello, {firstName || "Driver"}</Text>
              <View style={styles.rolePill}>
                <Ionicons name="car-sport-outline" size={13} color="#3B82F6" />
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
              : "Offer a ride from your saved commute or create a custom pickup for one-off trips."}
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
            <TouchableOpacity
              style={styles.heroPrimaryAction}
              onPress={handleScheduleOffer}
              activeOpacity={0.88}
            >
              <Ionicons name="flash-outline" size={16} color="#3B82F6" />
              <Text style={styles.heroPrimaryActionText}>Offer from schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondaryAction}
              onPress={() => router.push("/driver/DriverSetup")}
              activeOpacity={0.88}
            >
              <Text style={styles.heroSecondaryActionText}>Edit setup</Text>
            </TouchableOpacity>
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
            <View style={styles.iconBadge}>
              <Ionicons name="trail-sign-outline" size={18} color="#3B82F6" />
            </View>
          </View>

          {scheduleLoading ? (
            <ActivityIndicator
              size="small"
              color="#3B82F6"
              style={styles.inlineLoader}
            />
          ) : (
            <>
              <View style={styles.routePanel}>
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>From</Text>
                  <Text style={styles.routeValue}>{from ?? "—"}</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>Class starts</Text>
                  <Text style={styles.routeValue}>{formatTime12h(classStart)}</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>Class ends</Text>
                  <Text style={styles.routeValue}>{formatTime12h(classEnd)}</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>Pickup time</Text>
                  <TextInput
                    style={styles.inlineTimeInput}
                    value={pickupTime}
                    onChangeText={setPickupTime}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

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
            <View style={styles.iconBadgeWarm}>
              <Ionicons name="timer-outline" size={18} color="#3B82F6" />
            </View>
          </View>

          <Text style={styles.cardDescription}>
            Use this when you are driving outside your normal routine or want to post a ride
            at a specific time.
          </Text>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <TextInput
            style={styles.input}
            placeholder="Off-campus house, Westerlin, library"
            placeholderTextColor="#94A3B8"
            value={manualPickup}
            onChangeText={(value) => {
              setManualPickup(value);
              if (manualFieldError) setManualFieldError(null);
            }}
          />

          <Text style={styles.inputLabel}>Going to</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional destination for rider context"
            placeholderTextColor="#94A3B8"
            value={manualDropoff}
            onChangeText={setManualDropoff}
          />

          <Text style={styles.inputLabel}>Pickup time</Text>
          <TextInput
            style={styles.input}
            placeholder="24h format, for example 08:30"
            placeholderTextColor="#94A3B8"
            value={manualTime}
            onChangeText={(value) => {
              setManualTime(value);
              if (manualFieldError) setManualFieldError(null);
            }}
            keyboardType="numbers-and-punctuation"
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

        <View style={styles.sectionHeaderCompact}>
          <View>
            <Text style={styles.sectionEyebrow}>Ride management</Text>
            <Text style={styles.sectionTitle}>Upcoming rides</Text>
          </View>
          <TouchableOpacity
            style={styles.inlineLink}
            onPress={() => router.push("/driver/ScheduledRidesDriver")}
            activeOpacity={0.75}
          >
            <Text style={styles.inlineLinkText}>View all</Text>
            <Ionicons name="arrow-forward" size={13} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {ridesLoading ? (
          <ActivityIndicator
            size="small"
            color="#3B82F6"
            style={styles.inlineLoader}
          />
        ) : previewGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={28} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>No accepted rides yet</Text>
            <Text style={styles.emptyStateText}>
              Accepted riders will show up here so you can review each trip or mark it complete.
            </Text>
          </View>
        ) : (
          previewGroups.map((group) => (
            <View key={group.key} style={styles.rideShell}>
              <TouchableOpacity
                style={styles.rideCard}
                activeOpacity={0.86}
                onPress={() =>
                  router.push({
                    pathname: "/driver/RideDetail",
                    params: {
                      day: group.day,
                      start_time: group.start_time,
                      pickup_loc: group.pickup_loc ?? "",
                      dropoff_loc: group.dropoff_loc ?? "",
                      riders: JSON.stringify(group.riders),
                    },
                  })
                }
              >
                <View style={styles.rideCardTop}>
                  <Text style={styles.rideDay}>
                    {DAY_LABELS[group.day] ?? group.day}
                  </Text>
                  <Text style={styles.rideTime}>
                    {formatTime12h(group.start_time)}
                  </Text>
                </View>

                <View style={styles.routeTagRow}>
                  <View style={styles.routeTag}>
                    <Ionicons name="navigate-outline" size={13} color="#64748B" />
                    <Text style={styles.routeTagText}>
                      {group.pickup_loc ?? "—"}
                    </Text>
                  </View>
                  {group.dropoff_loc ? (
                    <>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="#94A3B8"
                      />
                      <View style={styles.routeTag}>
                        <Ionicons name="flag-outline" size={13} color="#64748B" />
                        <Text style={styles.routeTagText}>{group.dropoff_loc}</Text>
                      </View>
                    </>
                  ) : null}
                </View>

                <View style={styles.riderStrip}>
                  <Text style={styles.riderStripLabel}>
                    {group.riders.length} rider
                    {group.riders.length === 1 ? "" : "s"}
                  </Text>
                  <View style={styles.riderChipRow}>
                    {group.riders.slice(0, 3).map((rider, index) => (
                      <View key={index} style={styles.riderChip}>
                        <Text style={styles.riderChipText}>
                          {rider?.name ?? "Rider"}
                        </Text>
                      </View>
                    ))}
                    {group.riders.length > 3 ? (
                      <View style={styles.riderChipMuted}>
                        <Text style={styles.riderChipMutedText}>
                          +{group.riders.length - 3}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>

              {group.rideIds?.length > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    completingKey === group.key && styles.completeButtonDisabled,
                  ]}
                  disabled={completingKey != null}
                  onPress={() => completeRides(group.key, group.rideIds)}
                  activeOpacity={0.88}
                >
                  {completingKey === group.key ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.completeButtonText}>Complete ride</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
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
    borderRadius: 8,
    padding: 22,
    overflow: "hidden",
    gap: 18,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#EFF6FF",
    top: -68,
    right: -24,
    opacity: 0.52,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#EFF6FF",
    bottom: -56,
    left: -24,
    opacity: 0.16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3B82F6",
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
    color: "#DBEAFE",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.7,
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
    color: "#DBEAFE",
    maxWidth: "94%",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.14)",
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#DBEAFE",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroPrimaryActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3B82F6",
  },
  heroSecondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSecondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
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
    color: "#173229",
    letterSpacing: -0.6,
  },
  scheduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  manualCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
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
    color: "#173229",
    lineHeight: 26,
    maxWidth: 240,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#55666a",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#dce7e0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeWarm: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#efdfc8",
    alignItems: "center",
    justifyContent: "center",
  },
  routePanel: {
    borderRadius: 10,
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
    backgroundColor: "#dfd3c0",
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6d7d82",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  routeValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#173229",
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
    color: "#67797d",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#667478",
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
    color: "#173229",
  },
  fieldError: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
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
    backgroundColor: "#e8d0a9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3B82F6",
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
    borderRadius: 10,
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
    color: "#173229",
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#67797d",
    textAlign: "center",
  },
  rideShell: {
    gap: 10,
  },
  rideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
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
    color: "#3B82F6",
  },
  rideTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7f9088",
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
    color: "#31443e",
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
    color: "#5f7169",
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
    backgroundColor: "#dfe8e2",
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
    backgroundColor: "#f0eadf",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  riderChipMutedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6e6e6e",
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
