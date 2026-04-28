import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  if (isNaN(h)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

function getInitial(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "R";
}

export default function RiderHome() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropoffLoc, setDropoffLoc] = useState(null);
  const [residence, setResidence] = useState(null);
  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualFieldError, setManualFieldError] = useState(null);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [rides, setRides] = useState([]);

  useEffect(() => {
    loadSchedule();
    loadRides();
  }, []);

  useEffect(() => {
    if (scheduleLoading) return;
    const seed =
      (pickupLoc && String(pickupLoc).trim()) ||
      (residence && String(residence).trim()) ||
      "";
    setManualPickup((prev) => (prev.trim() ? prev : seed));
  }, [scheduleLoading, pickupLoc, residence]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      setFirstName(
        user.given_name || (user.name ? user.name.split(" ")[0] : ""),
      );

      const [scheduleRes, userRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/schedule?user_id=eq.${user.id}&select=pickup_loc,dropoff_loc`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        ),
        fetch(`${SUPABASE_URL}/rest/v1/User?id=eq.${user.id}&select=residence`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }),
      ]);

      const [scheduleData, userData] = await Promise.all([
        scheduleRes.json(),
        userRes.json(),
      ]);
      setPickupLoc(scheduleData?.[0]?.pickup_loc ?? null);
      setDropoffLoc(scheduleData?.[0]?.dropoff_loc ?? null);
      setResidence(userData?.[0]?.residence ?? null);
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
        setRides([]);
        return;
      }

      const res = await fetch(
        `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(
          String(user.id),
        )}`,
      );
      if (!res.ok) {
        setRides([]);
        return;
      }

      const payload = await res.json();
      const ridesData = payload?.rides ?? [];
      if (!ridesData.length) {
        setRides([]);
        return;
      }

      const enriched = ridesData
        .map((ride) => ({
          ...ride,
          day:
            ride.day ??
            (ride.ride_date
              ? new Date(ride.ride_date)
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toLowerCase()
                  .slice(0, 3)
              : null),
        }))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

      setRides(enriched);
    } catch (_) {
      setRides([]);
    } finally {
      setRidesLoading(false);
    }
  }

  function validateManual() {
    const pickup = manualPickup.trim();
    const time = manualTime.trim();
    if (!pickup) {
      setManualFieldError(
        "Enter where you want to be picked up, such as a campus building or residence.",
      );
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
    const validated = validateManual();
    if (!validated) return;
    router.push({
      pathname: "/rider/RiderWaitingRoom",
      params: {
        from: validated.pickup,
        to: (manualDropoff.trim() || dropoffLoc || "").trim(),
        time: validated.time,
        matchMode: "manual",
      },
    });
  }

  function handleScheduleRequest() {
    router.push({
      pathname: "/rider/RiderWaitingRoom",
      params: {
        from: pickupLoc ?? "",
        to: dropoffLoc ?? "",
        matchMode: "schedule",
      },
    });
  }

  const previewRides = rides.slice(0, 3);
  const nextRide = rides[0] ?? null;
  const routeReady = Boolean(pickupLoc || dropoffLoc);

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
              <Text style={styles.eyebrow}>Campus commute</Text>
              <Text style={styles.heroTitle}>Hello, {firstName || "Rider"}</Text>
              <View style={styles.rolePill}>
                <Ionicons name="walk-outline" size={13} color="#163b67" />
                <Text style={styles.rolePillText}>Rider mode</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroSummary}>
            {nextRide
              ? `Next pickup ${DAY_LABELS[nextRide.day] ?? nextRide.day} at ${formatTime12h(
                  nextRide.start_time,
                )}.`
              : "Use your saved route for everyday matching, or request a one-off ride anytime."}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Upcoming</Text>
              <Text style={styles.metricValue}>{rides.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Default pickup</Text>
              <Text style={styles.metricValueSmall}>
                {pickupLoc || residence || "Add setup"}
              </Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={styles.heroPrimaryAction}
              onPress={handleScheduleRequest}
              activeOpacity={0.88}
            >
              <Ionicons name="flash-outline" size={16} color="#163b67" />
              <Text style={styles.heroPrimaryActionText}>Use saved route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondaryAction}
              onPress={() => router.push("/rider/RiderSetup")}
              activeOpacity={0.88}
            >
              <Text style={styles.heroSecondaryActionText}>Edit setup</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Two ways to ride</Text>
          <Text style={styles.sectionTitle}>Request a ride</Text>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardEyebrow}>Saved commute</Text>
              <Text style={styles.cardTitle}>Fastest option for regular trips</Text>
            </View>
            <View style={styles.iconBadge}>
              <Ionicons name="map-outline" size={18} color="#163b67" />
            </View>
          </View>

          {scheduleLoading ? (
            <ActivityIndicator
              size="small"
              color="#163b67"
              style={styles.inlineLoader}
            />
          ) : (
            <>
              <View style={styles.routePanel}>
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>From</Text>
                  <Text style={styles.routeValue}>{pickupLoc ?? "—"}</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>To</Text>
                  <Text style={styles.routeValue}>{dropoffLoc ?? "—"}</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeLabel}>Pickup timing</Text>
                  <Text style={styles.routeValue}>
                    {routeReady ? "From first class today" : "Finish setup first"}
                  </Text>
                </View>
              </View>

              <Text style={styles.helperText}>
                Best for your normal class-day commute with the route you already saved.
              </Text>
            </>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleScheduleRequest}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Request using schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.manualCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardEyebrow}>One-off request</Text>
              <Text style={styles.cardTitle}>Choose a custom pickup time</Text>
            </View>
            <View style={styles.iconBadgeWarm}>
              <Ionicons name="time-outline" size={18} color="#7a4c12" />
            </View>
          </View>

          <Text style={styles.cardDescription}>
            Use this for after-class pickups, late returns, or any ride that does not match
            your normal schedule.
          </Text>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <TextInput
            style={styles.input}
            placeholder="Augie Hall, Westerlin, library"
            placeholderTextColor="#8a93a5"
            value={manualPickup}
            onChangeText={(value) => {
              setManualPickup(value);
              if (manualFieldError) setManualFieldError(null);
            }}
          />

          <Text style={styles.inputLabel}>Going to</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional destination"
            placeholderTextColor="#8a93a5"
            value={manualDropoff}
            onChangeText={setManualDropoff}
          />

          <Text style={styles.inputLabel}>Pickup time</Text>
          <TextInput
            style={styles.input}
            placeholder="24h format, for example 16:45"
            placeholderTextColor="#8a93a5"
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
            onPress={handleManualRequest}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Request with custom time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderCompact}>
          <View>
            <Text style={styles.sectionEyebrow}>Ride management</Text>
            <Text style={styles.sectionTitle}>Upcoming rides</Text>
          </View>
          <View style={styles.headerLinksRow}>
            <TouchableOpacity
              style={styles.inlineLink}
              onPress={() => router.push("/rider/RideHistoryRider")}
              activeOpacity={0.75}
            >
              <Ionicons name="time-outline" size={13} color="#8b7351" />
              <Text style={[styles.inlineLinkText, { color: "#8b7351" }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inlineLink}
              onPress={() => router.push("/rider/ScheduledRidesRider")}
              activeOpacity={0.75}
            >
              <Text style={styles.inlineLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={13} color="#163b67" />
            </TouchableOpacity>
          </View>
        </View>

        {ridesLoading ? (
          <ActivityIndicator
            size="small"
            color="#163b67"
            style={styles.inlineLoader}
          />
        ) : previewRides.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={28} color="#8b96ac" />
            <Text style={styles.emptyStateTitle}>No rides booked yet</Text>
            <Text style={styles.emptyStateText}>
              Your accepted rides will appear here as soon as a driver match is confirmed.
            </Text>
          </View>
        ) : (
          previewRides.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.rideCard}
              activeOpacity={0.86}
              onPress={() =>
                router.push({
                  pathname: "/rider/RideDetailRider",
                  params: {
                    day: ride.day,
                    start_time: ride.start_time,
                    location: ride.location ?? "",
                    driverName: ride.driver?.name ?? "",
                    driverPic: ride.driver?.picture_url ?? "",
                    carMake: ride.car?.make ?? "",
                    carModel: ride.car?.model ?? "",
                    carColor: ride.car?.color ?? "",
                  },
                })
              }
            >
              <View style={styles.rideCardTop}>
                <Text style={styles.rideDay}>
                  {DAY_LABELS[ride.day] ?? ride.day}
                </Text>
                <Text style={styles.rideTime}>{formatTime12h(ride.start_time)}</Text>
              </View>

              <View style={styles.routeTagRow}>
                <View style={styles.routeTag}>
                  <Ionicons name="navigate-outline" size={13} color="#4f5d78" />
                  <Text style={styles.routeTagText}>{ride.location ?? "—"}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color="#9aa4b8" />
                <View style={styles.routeTag}>
                  <Ionicons name="school-outline" size={13} color="#4f5d78" />
                  <Text style={styles.routeTagText}>Augustana College</Text>
                </View>
              </View>

              <View style={styles.driverStrip}>
                <View style={styles.driverAvatarSmall}>
                  <Text style={styles.driverAvatarSmallText}>
                    {getInitial(ride.driver?.name || "D")}
                  </Text>
                </View>
                <View style={styles.driverMeta}>
                  <Text style={styles.driverNameText}>
                    {ride.driver?.name ?? "Driver assigned"}
                  </Text>
                  <Text style={styles.driverSubText}>
                    {ride.car
                      ? `${ride.car.color || ""} ${ride.car.make || ""} ${
                          ride.car.model || ""
                        }`.trim()
                      : "Vehicle details will appear here"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7a869d" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4efe5",
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 40,
    gap: 18,
  },
  heroCard: {
    backgroundColor: "#17365e",
    borderRadius: 28,
    padding: 22,
    overflow: "hidden",
    gap: 18,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#315b90",
    top: -72,
    right: -28,
    opacity: 0.48,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#ecd8a9",
    bottom: -62,
    left: -34,
    opacity: 0.18,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#f4efe5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#17365e",
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
    fontSize: 28,
    fontWeight: "800",
    color: "#fff8ea",
    letterSpacing: -0.7,
  },
  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#f4efe5",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#163b67",
  },
  heroSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: "#d7e2f1",
    maxWidth: "92%",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 248, 234, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 248, 234, 0.14)",
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#d2def0",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff8ea",
  },
  metricValueSmall: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff8ea",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#f3dfad",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroPrimaryActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#163b67",
  },
  heroSecondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(244, 239, 229, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSecondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f7f0e2",
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
    color: "#8b7351",
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#172b49",
    letterSpacing: -0.6,
  },
  scheduleCard: {
    backgroundColor: "#fbf7ef",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eadfce",
    gap: 14,
  },
  manualCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eadfce",
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
    color: "#8b7351",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#172b49",
    lineHeight: 26,
    maxWidth: 240,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#52607a",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#e4ebf7",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeWarm: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#f2e1c5",
    alignItems: "center",
    justifyContent: "center",
  },
  routePanel: {
    borderRadius: 20,
    backgroundColor: "#f4efe5",
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
    backgroundColor: "#e3d7c5",
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6c7687",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  routeValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#172b49",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#67748d",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6a7383",
    marginTop: 4,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d7cfbf",
    backgroundColor: "#f8f3eb",
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: "#172b49",
  },
  fieldError: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8d4e19",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#163b67",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff8ea",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#ead2aa",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17365e",
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
    color: "#163b67",
  },
  inlineLoader: {
    marginVertical: 12,
  },
  emptyState: {
    borderRadius: 24,
    backgroundColor: "#fbf7ef",
    borderWidth: 1,
    borderColor: "#eadfce",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#172b49",
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#67748d",
    textAlign: "center",
  },
  rideCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
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
    color: "#17365e",
  },
  rideTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7a869d",
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
    backgroundColor: "#f4efe5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  routeTagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#33415a",
  },
  driverStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#ece3d4",
    paddingTop: 14,
  },
  driverAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#dfe7f2",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarSmallText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17365e",
  },
  driverMeta: {
    flex: 1,
    gap: 2,
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#172b49",
  },
  driverSubText: {
    fontSize: 12,
    color: "#69748b",
  },
});
