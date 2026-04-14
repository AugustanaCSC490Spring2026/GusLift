import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { useMatching } from "../../context/MatchingContext";
import Svg, { Path, Circle, Rect } from "react-native-svg";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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

const CarSvg = ({ size = 48, color = COLORS.blue }) => (
  <Svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none">
    <Rect x="8" y="20" width="64" height="20" rx="6" fill={color} />
    <Path d="M18 20 L26 8 L54 8 L62 20" fill={color} />
    <Rect x="30" y="10" width="10" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
    <Rect x="42" y="10" width="10" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
    <Circle cx="22" cy="40" r="6" fill={COLORS.dark} />
    <Circle cx="22" cy="40" r="3" fill={COLORS.gray300} />
    <Circle cx="58" cy="40" r="6" fill={COLORS.dark} />
    <Circle cx="58" cy="40" r="3" fill={COLORS.gray300} />
    <Circle cx="8" cy="28" r="2" fill="#FBBF24" />
    <Circle cx="72" cy="28" r="2" fill="#EF4444" />
  </Svg>
);

// ─── Car Loader ─────────────────────────────────────────────────────────────
function CarLoader() {
  const translateX = useRef(new Animated.Value(-60)).current;
  const bounceY = useRef(new Animated.Value(0)).current;
  const dotScale1 = useRef(new Animated.Value(0.4)).current;
  const dotScale2 = useRef(new Animated.Value(0.4)).current;
  const dotScale3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 60, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -60, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    const animateDot = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.4, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    animateDot(dotScale1, 0);
    animateDot(dotScale2, 200);
    animateDot(dotScale3, 400);
  }, []);

  return (
    <View style={styles.carLoaderWrap}>
      <Animated.View style={{ transform: [{ translateX }, { translateY: bounceY }] }}>
        <CarSvg size={64} color={COLORS.blue} />
      </Animated.View>
      <View style={styles.roadLine} />
      <View style={styles.dotsRow}>
        {[dotScale1, dotScale2, dotScale3].map((dot, i) => (
          <Animated.View key={i} style={[styles.loaderDot, { transform: [{ scale: dot }] }]} />
        ))}
      </View>
    </View>
  );
}

export default function AvailableDrivers() {
  const router = useRouter();
  const {
    driverId: initialDriverId,
    driverName: initialDriverName,
    driverPic: initialDriverPic,
    driverTo: initialDriverTo,
    driverCar: initialDriverCar,
  } = useLocalSearchParams();
  const { connect, send, onMessage, userId, disconnect } = useMatching();
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
        msg.drivers.forEach((d) => {
          upsertDriverDirectory(d.driver_id, d);
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

  async function waitForAcceptedRide(driverId) {
    if (!driverId || !userId) return null;
    if (!BACKEND_URL) return null;
    const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
    const endpoint =
      `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(String(userId))}` +
      `&driver_id=${encodeURIComponent(String(driverId))}&limit=1`;

    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const payload = await res.json();
          const rows = payload?.rides ?? [];
          if (Array.isArray(rows) && rows[0]?.id) return rows[0].id;
        }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    return null;
  }

  async function handleConfirm() {
    if (!matchedDriver) return;
    setConfirming(true);
    send({ type: "accept_match", rider_id: userId, driver_id: matchedDriver.driver_id });
    const rideId = await waitForAcceptedRide(matchedDriver.driver_id);
    setConfirming(false);
    router.replace({
      pathname: "/rider/ScheduledRidesRider",
      params: rideId ? { rideId } : undefined,
    });
  }

  async function handleRejectAndKeepSearching() {
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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
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
            <CarLoader />
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
            </View>

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
  );
}

const styles = StyleSheet.create({
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
  loaderSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  carLoaderWrap: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  roadLine: { width: 200, height: 2, backgroundColor: COLORS.gray200, borderRadius: 1 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  loaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue },
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
  },
  greenDotOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  successPillText: { fontSize: 13, fontWeight: '700', color: '#166534' },

  // Driver Card
  driverCard: {
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
  },
  driverTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 16 },
  avatarPlaceholder: {
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
  },
  rejectButtonText: { color: COLORS.dark, fontSize: 14, fontWeight: '600' },
});
