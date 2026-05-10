import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
<<<<<<< HEAD
  Animated,
  Easing,
=======
  ActivityIndicator,
>>>>>>> origin/main
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
<<<<<<< HEAD
  Platform,
  StatusBar,
  SafeAreaView,
=======
>>>>>>> origin/main
} from "react-native";
import { useMatching } from "../../context/MatchingContext";
import Svg, { Path, Circle } from "react-native-svg";
import CarIllustration from "../../components/CarIllustration";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

function getInitial(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "D";
}

const COLORS = {
  blue: '#3B82F6',
  dark: '#0F172A',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  green: '#22C55E',
  greenBg: '#F0FDF4',
  amber: '#D97706',
  amberBg: '#FFFBEB',
};

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const BackIcon = ({ size = 20, color = COLORS.dark }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" />
    <Path d="M12 19l-7-7 7-7" />
  </Svg>
);

const CheckIcon = ({ size = 20, color = COLORS.green }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

export default function AvailableDrivers() {
  const router = useRouter();
  const {
    driverId: initialDriverId,
    driverName: initialDriverName,
    driverPic: initialDriverPic,
    driverTo: initialDriverTo,
    driverCar: initialDriverCar,
    from,
    to,
  } = useLocalSearchParams();
  const { send, onMessage, userId, disconnect } = useMatching();
  const [matchedDriver, setMatchedDriver] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const driverDirectoryRef = useRef(new Map());

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const greenPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
  }, []);

  // Animate card when driver match appears
  useEffect(() => {
    if (matchedDriver) {
      Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(greenPulse, { toValue: 1.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(greenPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [matchedDriver]);

  function upsertDriverDirectory(driverId, rawDriver) {
    if (!driverId || !rawDriver) return;
    const carParts = rawDriver.car
      ? [
          [rawDriver.car.color, rawDriver.car.make, rawDriver.car.model]
            .filter(Boolean)
            .join(" ")
            .trim(),
          rawDriver.car.license_plate,
        ].filter(Boolean)
      : [];
    driverDirectoryRef.current.set(String(driverId), {
      name: rawDriver.name ?? null,
      picture_url: rawDriver.picture_url ?? null,
      to_location: rawDriver.to_location ?? null,
      car: carParts.length ? carParts.join(" · ") : null,
    });
  }

  useEffect(() => {
    const unsubscribe = onMessage(async (msg) => {
      if (msg.type === "initial_state" && Array.isArray(msg.drivers)) {
        msg.drivers.forEach((driver) => {
          upsertDriverDirectory(driver.driver_id, driver);
        });
      }
      if (msg.type === "driver_joined") {
        upsertDriverDirectory(msg.driver_id, msg);
      }
      if (msg.type === "match_request") {
        const fallbackDriver = driverDirectoryRef.current.get(String(msg.driver_id));
        const sourceDriver = msg.driver ?? fallbackDriver ?? null;
        let driver = {
          name: null,
          picture_url: null,
          to_location: null,
          car: null,
        };
        if (sourceDriver) {
          const carParts = sourceDriver.car
            ? [
                [sourceDriver.car.color, sourceDriver.car.make, sourceDriver.car.model]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
                sourceDriver.car.license_plate,
              ].filter(Boolean)
            : [];
          driver = {
            name: sourceDriver.name ?? null,
            picture_url: sourceDriver.picture_url ?? null,
            to_location: sourceDriver.to_location ?? null,
            car: carParts.length ? carParts.join(" · ") : null,
          };
        }
        setMatchedDriver({ ...driver, driver_id: msg.driver_id });
        setConfirming(false);
      }
      if (msg.type === "rider_joined" && msg.rider?.rider_id === userId) {
        setMatchedDriver(null);
        setConfirming(false);
      }
    });
    return () => unsubscribe?.();
  }, [userId]);

  useEffect(() => {
<<<<<<< HEAD
    if (initialDriverId) {
      const hydratedFromParams = {
        name: initialDriverName ? String(initialDriverName) : null,
        picture_url: initialDriverPic ? String(initialDriverPic) : null,
        to_location: initialDriverTo ? String(initialDriverTo) : null,
        car: initialDriverCar ? String(initialDriverCar) : null,
      };
      setMatchedDriver({
        ...hydratedFromParams,
        driver_id: initialDriverId,
      });
    }
  }, [initialDriverId, initialDriverName, initialDriverPic, initialDriverTo, initialDriverCar]);
=======
    if (!initialDriverId) return;
    setMatchedDriver({
      name: initialDriverName ? String(initialDriverName) : null,
      picture_url: initialDriverPic ? String(initialDriverPic) : null,
      to_location: initialDriverTo ? String(initialDriverTo) : null,
      car: initialDriverCar ? String(initialDriverCar) : null,
      driver_id: initialDriverId,
    });
  }, [
    initialDriverId,
    initialDriverName,
    initialDriverPic,
    initialDriverTo,
    initialDriverCar,
  ]);
>>>>>>> origin/main

  async function waitForAcceptedRide(driverId) {
    if (!driverId || !userId) return null;
    if (!BACKEND_URL) return null;
    const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
    const endpoint =
      `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(
        String(userId),
      )}` +
      `&driver_id=${encodeURIComponent(String(driverId))}&limit=1`;

    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const payload = await res.json();
          const rows = payload?.rides ?? [];
          if (Array.isArray(rows) && rows[0]?.id) return rows[0].id;
        }
      } catch (_) {
        // Keep polling briefly while the backend writes the accepted ride.
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    return null;
  }

  async function handleConfirm() {
    if (!matchedDriver) return;
    setConfirming(true);
    const riderTo = to
      ? String(Array.isArray(to) ? to[0] : to).trim()
      : "";
    send({
      type: "accept_match",
      rider_id: userId,
      driver_id: matchedDriver.driver_id,
      ...(riderTo ? { rider_to_location: riderTo } : {}),
    });
    const rideId = await waitForAcceptedRide(matchedDriver.driver_id);
    setConfirming(false);
    router.replace({
      pathname: "/rider/ScheduledRidesRider",
      params: rideId ? { rideId } : undefined,
    });
  }

  function handleRejectAndKeepSearching() {
    if (!matchedDriver || !userId) return;
    setConfirming(true);
    send({
      type: "reject_match",
      rider_id: userId,
      driver_id: matchedDriver.driver_id,
    });
    setMatchedDriver(null);
    setConfirming(false);
  }

  function handleCancel() {
    disconnect();
<<<<<<< HEAD
    router.replace("/rider/RequestRide");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {matchedDriver ? "DRIVER FOUND" : "FINDING DRIVER"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {!matchedDriver ? (
          /* ── Waiting State ─────────────────────────────────────── */
          <View style={styles.loaderSection}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <CarIllustration isHovered={true} />
            </View>
            <Text style={styles.loaderTitle}>Looking for a driver...</Text>
            <Text style={styles.loaderSub}>You will be notified when a driver accepts your ride.</Text>
          </View>
        ) : (
          /* ── Driver Found ──────────────────────────────────────── */
          <View style={styles.matchSection}>
            {/* Success Pill */}
            <View style={styles.successPill}>
              <Animated.View style={[styles.greenDotOuter, { transform: [{ scale: greenPulse }] }]}>
                <View style={styles.greenDot} />
              </Animated.View>
              <Text style={styles.successPillText}>Driver matched successfully</Text>
=======
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ridesButton}
          onPress={() => router.push("/rider/ScheduledRidesRider")}
          activeOpacity={0.82}
        >
          <Text style={styles.ridesButtonText}>My rides</Text>
        </TouchableOpacity>
      </View>

      {!matchedDriver ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>Match search</Text>
            <Text style={styles.heroTitle}>Looking for a driver</Text>
            <Text style={styles.heroBody}>
              Stay here while matching runs. As soon as a driver accepts, you can review the
              details and confirm the ride.
            </Text>
          </View>

          <View style={styles.tripCard}>
            <Text style={styles.tripTitle}>Current request</Text>
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>From</Text>
              <Text style={styles.tripValue}>{from || "—"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>To</Text>
              <Text style={styles.tripValue}>{to || "—"}</Text>
            </View>
          </View>

          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color="#17365e" />
            <Text style={styles.waitingTitle}>Matching is active</Text>
            <Text style={styles.waitingBody}>
              We will move you forward as soon as a driver becomes available for this route.
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.heroCardMatched}>
            <View style={styles.heroGlowMatched} />
            <Text style={styles.heroEyebrow}>Driver found</Text>
            <Text style={styles.heroTitle}>Review your match</Text>
            <Text style={styles.heroBody}>
              Confirm this driver to lock in the ride, or reject and keep searching for another
              option.
            </Text>
          </View>

          <View style={styles.driverCard}>
            {matchedDriver.picture_url ? (
              <Image source={{ uri: matchedDriver.picture_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {getInitial(matchedDriver.name)}
                </Text>
              </View>
            )}

            <View style={styles.driverMeta}>
              <Text style={styles.driverName}>
                {matchedDriver.name ?? "Unknown driver"}
              </Text>
              <Text style={styles.driverLabel}>Assigned driver</Text>
>>>>>>> origin/main
            </View>
          </View>

          <View style={styles.matchInfoCard}>
            {matchedDriver.to_location ? (
              <>
                <View style={styles.tripRow}>
                  <Text style={styles.tripLabel}>Driver route</Text>
                  <Text style={styles.tripValue}>{matchedDriver.to_location}</Text>
                </View>
                <View style={styles.divider} />
              </>
            ) : null}
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>Vehicle</Text>
              <Text style={styles.tripValue}>
                {matchedDriver.car || "Vehicle details unavailable"}
              </Text>
            </View>
          </View>

<<<<<<< HEAD
            {/* Driver Card */}
            <Animated.View style={[styles.driverCard, { transform: [{ scale: cardScale }] }]}>
              <View style={styles.driverTopRow}>
                {matchedDriver.picture_url ? (
                  <Image source={{ uri: matchedDriver.picture_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {matchedDriver.name ? matchedDriver.name[0].toUpperCase() : "?"}
                    </Text>
                  </View>
                )}
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{matchedDriver.name ?? "Unknown Driver"}</Text>
                  {matchedDriver.car && (
                    <Text style={styles.driverCar}>{matchedDriver.car}</Text>
                  )}
                  {matchedDriver.to_location && (
                    <Text style={styles.driverMeta}>Heading to: {matchedDriver.to_location}</Text>
                  )}
                </View>
                <View style={styles.checkCircle}>
                  <CheckIcon size={18} color={COLORS.white} />
                </View>
              </View>
            </Animated.View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.confirmButton, confirming && { opacity: 0.6 }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={confirming}
            >
              {confirming ? (
                <Text style={styles.confirmButtonText}>Confirming...</Text>
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Ride</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleRejectAndKeepSearching}
              activeOpacity={0.85}
              disabled={confirming}
            >
              <Text style={styles.rejectButtonText}>Reject & Keep Searching</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
=======
          <TouchableOpacity
            style={[styles.primaryButton, confirming && styles.primaryButtonDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.86}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff9ef" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm this driver</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRejectAndKeepSearching}
            activeOpacity={0.86}
            disabled={confirming}
          >
            <Text style={styles.secondaryButtonText}>Reject and keep searching</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
>>>>>>> origin/main
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 12, fontWeight: '800', color: COLORS.dark, letterSpacing: 2 },
  content: { flex: 1, padding: 20 },

  // Loader
  loaderSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  loaderSub: { fontSize: 14, color: COLORS.gray400, textAlign: 'center', lineHeight: 20 },

  // Match
  matchSection: { flex: 1, justifyContent: 'center', gap: 16 },

  // Success Pill
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
=======
  screen: {
    flex: 1,
    backgroundColor: "#f4efe5",
    paddingHorizontal: 20,
    paddingTop: 60,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#ebe4d7",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#45556d",
  },
  ridesButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#ded2be",
  },
  ridesButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#45556d",
  },
  heroCard: {
    backgroundColor: "#17365e",
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#315b90",
    top: -58,
    right: -28,
    opacity: 0.45,
  },
  heroCardMatched: {
    backgroundColor: "#7c5120",
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroGlowMatched: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#d8b172",
    top: -58,
    right: -28,
    opacity: 0.28,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#f0dcc0",
  },
  heroTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: "#fff9ef",
    letterSpacing: -0.7,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#efe0cb",
    maxWidth: "94%",
  },
  tripCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e7dcc9",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17365e",
    marginBottom: 10,
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  tripLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6e7d92",
  },
  tripValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#1d304a",
  },
  divider: {
    height: 1,
    backgroundColor: "#ece3d4",
  },
  waitingCard: {
    backgroundColor: "#fbf7ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e7dcc9",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17365e",
    textAlign: "center",
  },
  waitingBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#67748d",
    textAlign: "center",
>>>>>>> origin/main
  },
  greenDotOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  successPillText: { fontSize: 13, fontWeight: '700', color: '#166534' },

  // Driver Card
  driverCard: {
<<<<<<< HEAD
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.gray100,
=======
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ead6b8",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
>>>>>>> origin/main
  },
  driverTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 16 },
  avatarPlaceholder: {
<<<<<<< HEAD
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: COLORS.blue },
  driverInfo: { flex: 1, gap: 2 },
  driverName: { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  driverCar: { fontSize: 13, color: COLORS.gray400, fontWeight: '600' },
  driverMeta: { fontSize: 12, color: COLORS.gray400 },
  checkCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },

  // Buttons
  confirmButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.blue,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  confirmButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  rejectButton: {
    backgroundColor: COLORS.gray100,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
=======
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#e7eef8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17365e",
  },
  driverMeta: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2a251d",
  },
  driverLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8d6b3f",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  matchInfoCard: {
    backgroundColor: "#fff8ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ead6b8",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#7c5120",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff9ef",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#efe3d2",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#5f4a32",
>>>>>>> origin/main
  },
  rejectButtonText: { color: COLORS.dark, fontSize: 14, fontWeight: '600' },
});
