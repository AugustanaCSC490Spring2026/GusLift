import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import LocationTimeline, { CircleIcon, SquareIcon } from "../../components/LocationTimeline";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ─── Color tokens ─── */
const C = {
  brand: "#3B82F6",
  brandLight: "rgba(59,130,246,0.08)",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E2E8F0",
  fieldBg: "#F1F5F9",
  amber: "#F59E0B",
};

/* ─── SVG Icons (render on all platforms) ─── */
function MapPinIcon({ size = 18, color = C.brand }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={color}
        opacity={0.2}
      />
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} fill={color} />
    </Svg>
  );
}

function NavigationIcon({ size = 18, color = C.subtle }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11l19-9-9 19-2-8-8-2z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon({ size = 14, color = C.brand }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
      <Path
        d="M12 6v6l4 2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CalendarIcon({ size = 18, color = "#cbd5e1" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon({ size = 20, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
      <Path
        d="M9 12l2 2 4-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AnimatedPrimaryButton({ onPress, text, style, textStyle }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onHoverIn = () => {
    Platform.OS === 'web' && Animated.spring(scale, { toValue: 1.03, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const onHoverOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
      onPressOut={onHoverOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
}


/* ═══════════════════════════════════════════════════════════
   REQUEST RIDE — main component
   ═══════════════════════════════════════════════════════════ */
export default function RequestRide() {
  const router = useRouter();
  const { pickup: landingPickup, destination: landingDestination } =
    useLocalSearchParams();

  /* ── Data state (unchanged backend logic) ── */
  const [loading, setLoading] = useState(true);
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropoffLoc, setDropoffLoc] = useState(null);
  const [residence, setResidence] = useState(null);
  const [classStart, setClassStart] = useState(null);
  const [classEnd, setClassEnd] = useState(null);
  const [firstName, setFirstName] = useState("");

  /* ── UI state ── */
  const [mode, setMode] = useState("manual");
  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualFieldError, setManualFieldError] = useState(null);
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  /* ── Animations ── */
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);

  /* ── Load schedule data from Supabase (UNCHANGED) ── */
  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (landingPickup) {
      setManualPickup(landingPickup);
    } else {
      const seed =
        (pickupLoc && String(pickupLoc).trim()) ||
        (residence && String(residence).trim()) ||
        "";
      setManualPickup((prev) => (prev.trim() ? prev : seed));
    }
    
    if (landingDestination) {
      setManualDropoff(landingDestination);
    } else if (dropoffLoc) {
      setManualDropoff((prev) => (prev.trim() ? prev : dropoffLoc));
    }
  }, [loading, pickupLoc, dropoffLoc, residence, landingPickup, landingDestination]);

  async function loadSchedule() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      // Give preference to `given_name`, then `name`, then `email`.
      const nameComponent = user.given_name || (user.name ? user.name.split(" ")[0] : "");
      setFirstName(nameComponent);

      const [scheduleRes, userRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/schedule?user_id=eq.${user.id}&select=pickup_loc,dropoff_loc`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/User?id=eq.${user.id}&select=residence`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        ),
      ]);

      const [scheduleData, userData] = await Promise.all([
        scheduleRes.json(),
        userRes.json(),
      ]);

      const startT = scheduleData?.[0]?.start_time;
      const endT = scheduleData?.[0]?.end_time;

      setPickupLoc(scheduleData?.[0]?.pickup_loc ?? null);
      setDropoffLoc(scheduleData?.[0]?.dropoff_loc ?? null);
      setResidence(userData?.[0]?.residence ?? null);
      setClassStart(startT ?? null);
      setClassEnd(endT ?? null);
    } catch (_) {
      // leave blank
    } finally {
      setLoading(false);
    }
  }

  /* ── Validation & navigation (UNCHANGED logic) ── */
  function validateManual() {
    const pickup = manualPickup.trim();
    const timeVal = manualTime.trim();
    if (!pickup) {
      setManualFieldError(
        "Enter where you want to be picked up (e.g. campus building or residence)."
      );
      return null;
    }
    if (!TIME_RE.test(timeVal)) {
      setManualFieldError("Invalid time. Use 24h format like 14:30.");
      return null;
    }
    setManualFieldError(null);
    return { pickup, time: timeVal };
  }

  function handleManualRequest() {
    const v = validateManual();
    if (!v) return;
    router.push({
      pathname: "/rider/RiderWaitingRoom",
      params: {
        from: v.pickup,
        to: (manualDropoff.trim() || dropoffLoc || "").trim(),
        time: v.time,
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

  /* ── Loading state ── */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  function formatTime(t) {
    if (!t) return "No entry found";
    const [h, m] = t.split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  }

  /* ── Render ── */
  return (
    <Animated.View style={[styles.outer, { opacity: fadeIn }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {firstName ? (
            <Text style={styles.greeting}>Hello {firstName},</Text>
          ) : null}
          <Text style={styles.title}>Where to today?</Text>
        </View>

        {/* ── Mode Toggle ── */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[
              styles.modeTab,
              mode === "manual" && styles.modeTabActive,
            ]}
            onPress={() => setMode("manual")}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === "manual" && styles.modeTabTextActive,
              ]}
            >
              Custom
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeTab,
              mode === "schedule" && styles.modeTabActive,
            ]}
            onPress={() => setMode("schedule")}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === "schedule" && styles.modeTabTextActive,
              ]}
            >
              Schedule
            </Text>
          </Pressable>
        </View>

        {/* ── Custom Mode ── */}
        {mode === "manual" ? (
          <View style={styles.modeContent}>
            <View style={styles.card}>
              {/* Pickup Location */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PICKUP LOCATION</Text>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIconWrap}>
                    <CircleIcon size={18} color={C.text} />
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Westerlin Hall, library"
                    placeholderTextColor={C.subtle}
                    value={manualPickup}
                    onChangeText={(t) => {
                      setManualPickup(t);
                      if (manualFieldError) setManualFieldError(null);
                    }}
                  />
                </View>
              </View>

              {/* Drop Location */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DROP LOCATION (OPTIONAL)</Text>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIconWrap}>
                    <SquareIcon size={18} color={C.text} />
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Where are you heading?"
                    placeholderTextColor={C.subtle}
                    value={manualDropoff}
                    onChangeText={setManualDropoff}
                  />
                </View>
              </View>

              {/* Pickup Time */}
              <View style={{ marginBottom: 0 }}>
                <View style={styles.timeLabelRow}>
                  <Text style={styles.fieldLabel}>PICKUP TIME (24H)</Text>
                </View>
                <View style={styles.timeDisplay}>
                  <Text style={styles.timeDayLabel}>TODAY</Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={styles.timeBigInput}
                      placeholder="e.g. 15:30"
                      placeholderTextColor={C.border}
                      value={manualTime}
                      onChangeText={(t) => {
                        setManualTime(t);
                        if (manualFieldError) setManualFieldError(null);
                      }}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>

              {manualFieldError ? (
                <Text style={styles.fieldError}>{manualFieldError}</Text>
              ) : null}
            </View>

            {/* Request button */}
            <AnimatedPrimaryButton
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
              onPress={handleManualRequest}
              text="Request a ride"
            />
          </View>
        ) : (
          /* ── Schedule Mode ── */
          <View style={styles.modeContent}>
            <Text style={{ fontSize: 13, color: C.muted, marginHorizontal: 4, lineHeight: 20, fontWeight: "500" }}>
              This is your upcoming schedule. Would you like to request a ride for this configuration?
            </Text>

            <TouchableOpacity 
              activeOpacity={0.7} 
              style={[styles.card, styles.scheduleCard, { paddingVertical: 12 }]}
              onPress={() => setShowScheduleDetails(true)}
            >
              <LocationTimeline
                noTimeLine={true}
                dateValue={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                timeLabel="Class start time"
                timeValue="From first class"
                pickupValue={pickupLoc ?? "Not set"}
                dropoffValue={dropoffLoc ?? "Not selected"}
              />
              <Text style={{ fontSize: 11, color: C.brand, textAlign: "center", marginTop: 8, fontWeight: "700" }}>
                TAP TO VIEW FULL DETAILS
              </Text>
            </TouchableOpacity>

            <AnimatedPrimaryButton
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
              onPress={handleScheduleRequest}
              text="Request using schedule"
            />
          </View>
        )}

      </ScrollView>

      {/* Schedule Detail Modal */}
      {showScheduleDetails && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Details</Text>
              <TouchableOpacity onPress={() => setShowScheduleDetails(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 20, color: C.muted, fontWeight: "600" }}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailVal}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pickup Location</Text>
                <Text style={styles.detailVal}>{pickupLoc ?? "Not set"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Drop-off Location</Text>
                <Text style={styles.detailVal}>{dropoffLoc ?? "Not selected"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class Start Time</Text>
                <Text style={styles.detailVal}>{formatTime(classStart)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class End Time</Text>
                <Text style={styles.detailVal}>{formatTime(classEnd)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowScheduleDetails(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20, paddingBottom: 24, flexGrow: 1, justifyContent: "center" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },

  /* Header */
  header: {
    marginBottom: 16,
    paddingRight: 48, // leave room for the GlobalMenu hamburger in top-right
  },
  greeting: {
    fontSize: 13,
    fontWeight: "500",
    color: C.muted,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: C.text,
  },

  /* Mode toggle */
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(148,163,184,0.15)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: C.card,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.muted,
  },
  modeTabTextActive: {
    color: C.brand,
  },

  /* Content area */
  modeContent: {
    gap: 12,
  },

  /* Card */
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
    }),
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.subtle,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.fieldBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
  },
  fieldIconWrap: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    ...Platform.select({
      web: { outlineStyle: "none" },
      default: {},
    }),
  },
  fieldError: {
    fontSize: 13,
    color: C.danger,
    marginTop: 8,
  },

  /* Time display (Big Input) */
  timeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  timeDisplay: {
    backgroundColor: C.fieldBg,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeDayLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.brand,
    marginBottom: 0,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeBigInput: {
    fontSize: 32,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -1,
    flex: 1,
    padding: 0,
    margin: 0,
    ...Platform.select({
      web: { outlineStyle: "none" },
      default: {},
    }),
  },

  /* Modal Details */
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    padding: 24,
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(0,0,0,0.15)" },
      default: { elevation: 10, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20 }
    })
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  modalBody: {
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.brand,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailVal: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  modalCloseBtn: {
    backgroundColor: C.text,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  /* Primary button */
  primaryButton: {
    backgroundColor: C.brand,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(59,130,246,0.30)",
        cursor: "pointer",
      },
      default: {
        shadowColor: C.brand,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  /* Schedule card */
  scheduleCard: {
    borderLeftWidth: 4,
    borderLeftColor: C.brand,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  scheduleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  scheduleBadge: {
    backgroundColor: "rgba(59,130,246,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scheduleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.brand,
    letterSpacing: 1,
  },
  scheduleGrid: {
    flexDirection: "row",
    gap: 16,
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.subtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  scheduleValueMuted: {
    opacity: 0.6,
    fontStyle: "italic",
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 16,
  },
  scheduleTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleTimeBig: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
  },

  /* Bottom grid (upcoming + history) */
  bottomGrid: {
    flexDirection: "row",
    gap: 20,
    marginTop: 40,
  },
  bottomCol: {
    flex: 1,
  },
  bottomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  bottomHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bottomTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: C.text,
    letterSpacing: 1,
  },
  bottomViewAll: {
    fontSize: 10,
    fontWeight: "700",
    color: C.brand,
    letterSpacing: 0.5,
  },
  emptyCard: {
    height: 120,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.subtle,
    fontStyle: "italic",
  },
});
