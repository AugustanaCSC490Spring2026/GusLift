import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useMatching } from "../../context/MatchingContext";

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
  const { pendingMatch } = useMatching();

  const [firstName, setFirstName] = useState("");
  const [pictureUrl, setPictureUrl] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropoffLoc, setDropoffLoc] = useState(null);
  const [residence, setResidence] = useState(null);
  const [schedulePickup, setSchedulePickup] = useState("");
  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualFieldError, setManualFieldError] = useState(null);
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
    setSchedulePickup((prev) => (prev.trim() ? prev : seed));
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
        fetch(`${SUPABASE_URL}/rest/v1/User?id=eq.${user.id}&select=residence,picture_url`, {
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
      if (userData?.[0]?.picture_url) setPictureUrl(userData[0].picture_url);
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
        from: schedulePickup.trim() || (pickupLoc ?? ""),
        to: dropoffLoc ?? "",
        matchMode: "schedule",
      },
    });
  }

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
        {pendingMatch && (
          <Pressable
            style={styles.pendingMatchCard}
            onPress={() => {
              const carParts = pendingMatch.driver?.car
                ? [
                    [pendingMatch.driver.car.color, pendingMatch.driver.car.make, pendingMatch.driver.car.model]
                      .filter(Boolean).join(" ").trim(),
                    pendingMatch.driver.car.license_plate,
                  ].filter(Boolean)
                : [];
              router.push({
                pathname: "/rider/AvailableDrivers",
                params: {
                  driverId: pendingMatch.driver_id,
                  driverName: pendingMatch.driver?.name ?? "",
                  driverPic: pendingMatch.driver?.picture_url ?? "",
                  driverTo: pendingMatch.driver?.to_location ?? "",
                  driverCar: carParts.join(" · "),
                },
              });
            }}
            activeOpacity={0.88}
          >
            <View style={styles.pendingMatchLeft}>
              <Text style={styles.pendingMatchIcon}>⚡</Text>
              <View>
                <Text style={styles.pendingMatchTitle}>Driver found!</Text>
                <Text style={styles.pendingMatchSub}>
                  {pendingMatch.driver?.name
                    ? `${pendingMatch.driver.name} is waiting for you`
                    : "A driver is waiting for your confirmation"}
                </Text>
              </View>
            </View>
            <Text style={styles.pendingMatchChevron}>›</Text>
          </Pressable>
        )}

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
              <Text style={styles.heroTitle}>Hello, {firstName || "Rider"}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Rider mode</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroSummary}>
            {nextRide
              ? `Next pickup ${DAY_LABELS[nextRide.day] ?? nextRide.day} at ${formatTime12h(
                  nextRide.start_time,
                )}.`
              : "Request a ride using your schedule or set a custom pickup time."}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Upcoming rides</Text>
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
            <Pressable
              style={({ hovered, pressed }) => [
                styles.heroPrimaryAction,
                hovered && styles.heroActionHovered,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => router.push("/rider/ScheduledRidesRider")}
            >
              <Text style={styles.heroPrimaryActionText}>View upcoming rides</Text>
            </Pressable>
            <Pressable
              style={({ hovered, pressed }) => [
                styles.heroSecondaryAction,
                hovered && styles.heroActionHovered,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => router.push("/rider/ManageSchedule")}
            >
              <Text style={styles.heroSecondaryActionText}>View schedule</Text>
            </Pressable>
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
          </View>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <AutocompleteInput
            style={styles.input}
            placeholder="Augie Hall, Westerlin, library"
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
              <Text style={styles.inputLabel}>Going to</Text>
              <View style={styles.inputDisplay}>
                <Text style={styles.inputDisplayText}>{dropoffLoc ?? "Augustana College"}</Text>
              </View>

              <Text style={styles.inputLabel}>Pickup timing</Text>
              <View style={styles.inputDisplay}>
                <Text style={styles.inputDisplayText}>
                  {nextRide ? formatTime12h(nextRide.start_time) : "—"}
                </Text>
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
          </View>

          <Text style={styles.cardDescription}>
            Use this for after-class pickups, late returns, or any ride that does not match
            your normal schedule.
          </Text>

          <Text style={styles.inputLabel}>Pickup location</Text>
          <AutocompleteInput
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
          <AutocompleteInput
            style={styles.input}
            placeholder="Optional destination"
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
            onPress={handleManualRequest}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Request with custom time</Text>
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
  pendingMatchCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingMatchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  pendingMatchIcon: {
    fontSize: 22,
  },
  pendingMatchTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  pendingMatchSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  pendingMatchChevron: {
    fontSize: 26,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 28,
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
    top: -72,
    right: -28,
    opacity: 0.2,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#FFFFFF",
    bottom: -62,
    left: -34,
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
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
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
    maxWidth: "92%",
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
  metricValueSmall: {
    fontSize: 15,
    fontWeight: "700",
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
  driverStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 14,
  },
  driverAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarSmallText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3B82F6",
  },
  driverMeta: {
    flex: 1,
    gap: 2,
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  driverSubText: {
    fontSize: 12,
    color: "#64748B",
  },
});
