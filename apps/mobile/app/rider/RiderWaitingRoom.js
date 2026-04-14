import { useMatching } from "../../context/MatchingContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import CarIllustration from "../../components/CarIllustration";

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
  red: '#EF4444',
  redBg: '#FEF2F2',
};

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const BackIcon = ({ size = 20, color = COLORS.dark }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" />
    <Path d="M12 19l-7-7 7-7" />
  </Svg>
);

const ClockIcon = ({ size = 16, color = COLORS.blue }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTime12h(timeStr) {
  const router = useRouter();
  const { connect, send, onMessage, disconnect } = useMatching();
  const params = useLocalSearchParams();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  const matchMode = Array.isArray(params.matchMode) ? params.matchMode[0] : params.matchMode;
  const timeParam = Array.isArray(params.time) ? params.time[0] : params.time;

  const isManualEntry =
    matchMode === "manual" &&
    timeParam &&
    TIME_RE.test(String(timeParam).trim()) &&
    String(from ?? "").trim().length > 0;

  const [connected, setConnected] = useState(false);
  const [needsManualTime, setNeedsManualTime] = useState(false);
  const [manualTime, setManualTime] = useState("");
  const [manualLocation, setManualLocation] = useState(from ?? "");
  const [connectError, setConnectError] = useState(null);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const greenPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
  }, []);

  // Green dot pulse when connected
  useEffect(() => {
    if (connected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(greenPulse, { toValue: 1.5, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(greenPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [connected]);

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    async function setup() {
      setConnectError(null);
      unsubscribe = onMessage((msg) => {
        if (msg.type === "match_request") {
          const driverCar = msg.driver?.car
            ? [
                [
                  msg.driver.car.color,
                  msg.driver.car.make,
                  msg.driver.car.model,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
                msg.driver.car.license_plate,
              ]
                .filter(Boolean)
                .join(" · ")
            : "";
          router.replace({
            pathname: "/rider/AvailableDrivers",
            params: {
              from,
              to,
              driverId: msg.driver_id,
              driverName: msg.driver?.name ?? "",
              driverPic: msg.driver?.picture_url ?? "",
              driverTo: msg.driver?.to_location ?? "",
              driverCar,
            },
          });
        }
      });

      const trimmedFrom = String(from ?? "").trim();
      const trimmedTime = timeParam ? String(timeParam).trim() : "";

      const result = isManualEntry
        ? await connect({ location: trimmedFrom, time: trimmedTime })
        : await connect();

      if (cancelled) return;

      if (result?.needsManualTime) {
        setNeedsManualTime(true);
        setManualLocation(trimmedFrom || "");
        setManualTime(trimmedTime || "");
        return;
      }
      if (result?.ok && result.userId) {
        send({ type: "rider_request", rider_id: result.userId });
        setConnected(true);
        return;
      }
      setConnectError(result?.error ?? "Could not start matching. Try again.");
    }

    setup();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function handleManualContinue() {
    setConnectError(null);
    const loc = (manualLocation || from || "").trim();
    const time = manualTime.trim();
    if (!loc || !TIME_RE.test(time)) {
      return;
    }
    const result = await connect({ location: loc, time });
    if (result?.ok && result.userId) {
      setNeedsManualTime(false);
      send({ type: "rider_request", rider_id: result.userId });
      setConnected(true);
    } else if (result?.error) {
      setConnectError(result.error);
    }
  }

  async function handleRetry() {
    setConnectError(null);
    const trimmedFrom = String(from ?? "").trim();
    const trimmedTime = timeParam ? String(timeParam).trim() : "";
    const result = isManualEntry
      ? await connect({ location: trimmedFrom, time: trimmedTime })
      : await connect();
    if (result?.needsManualTime) {
      setNeedsManualTime(true);
      return;
    }
    if (result?.ok && result.userId) {
      send({ type: "rider_request", rider_id: result.userId });
      setConnected(true);
    } else {
      setConnectError(result?.error ?? "Could not connect.");
    }
  }

  function handleCancel() {
    disconnect();
    router.replace("/rider/RequestRide");
  }

  const effectiveSlotTime =
    isManualEntry && timeParam
      ? String(timeParam).trim()
      : manualTime.trim() && TIME_RE.test(manualTime.trim())
        ? manualTime.trim()
        : null;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Requested</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Route Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.iconWrap}>
              <View style={styles.timelineDotCircle} />
            </View>
            <View style={styles.cardRowContent}>
              <Text style={styles.cardLabel}>PICKUP</Text>
              <Text style={styles.cardValue} numberOfLines={1}>{from || "—"}</Text>
            </View>
          </View>

          <View style={styles.timelineConnector} />

          <View style={styles.cardRow}>
            <View style={styles.iconWrap}>
              <View style={styles.timelineDotSquare} />
            </View>
            <View style={styles.cardRowContent}>
              <Text style={styles.cardLabel}>DESTINATION</Text>
              <Text style={styles.cardValue} numberOfLines={1}>{to || "—"}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardRow}>
            <View style={styles.iconWrap}>
              <ClockIcon size={16} color={COLORS.blue} />
            </View>
            <View style={styles.cardRowContent}>
              <Text style={styles.cardLabel}>PICKUP TIME</Text>
              <Text style={[styles.cardValue, { color: COLORS.blue }]}>
                {effectiveSlotTime
                  ? formatTime12h(effectiveSlotTime)
                  : needsManualTime
                    ? "Enter below"
                    : matchMode !== "manual" && !isManualEntry
                      ? "First class (today)"
                      : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Connection Status */}
        {connected && (
          <View style={styles.statusPill}>
            <Animated.View style={[styles.greenDotOuter, { transform: [{ scale: greenPulse }] }]}>
              <View style={styles.greenDot} />
            </Animated.View>
            <Text style={styles.statusPillText}>Connected — Searching for drivers</Text>
          </View>
        )}

        {/* Error State */}
        {connectError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{connectError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Manual Time Entry */}
        {needsManualTime ? (
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>When do you need a ride?</Text>
            <Text style={styles.manualHint}>
              No class block for today on your schedule. Enter your pickup time in 24-hour format (e.g. 16:30).
            </Text>
            {!from?.trim() ? (
              <TextInput
                style={styles.input}
                placeholder="Pickup location"
                placeholderTextColor={COLORS.gray300}
                value={manualLocation}
                onChangeText={setManualLocation}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.gray300}
              value={manualTime}
              onChangeText={setManualTime}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!manualTime.trim() || (!from?.trim() && !manualLocation.trim())) && styles.continueButtonDisabled,
              ]}
              onPress={handleManualContinue}
              disabled={!manualTime.trim() || (!from?.trim() && !manualLocation.trim())}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : !connectError ? (
          /* Car Animation Loader */
          <View style={styles.loaderSection}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <CarIllustration isHovered={true} />
            </View>
            <Text style={styles.loaderText}>
              {connected ? "Searching for available drivers..." : "Connecting to matching..."}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Bottom Cancel */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.85}>
          <Text style={styles.cancelButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.dark, letterSpacing: 1 },
  content: { flex: 1, padding: 20 },

  // Route Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 24, alignItems: 'center' },
  timelineDotCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.blue },
  timelineDotSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: COLORS.dark },
  timelineConnector: { width: 1, height: 24, backgroundColor: COLORS.gray200, marginLeft: 12, borderStyle: 'dashed' },
  cardRowContent: { flex: 1 },
  cardLabel: { fontSize: 9, fontWeight: '700', color: COLORS.gray400, letterSpacing: 1, marginBottom: 2 },
  cardValue: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  cardDivider: { height: 1, backgroundColor: COLORS.gray100, marginVertical: 14 },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  greenDotOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  statusPillText: { fontSize: 13, fontWeight: '600', color: '#166534' },

  // Car Loader Replace
  loaderSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { fontSize: 14, fontWeight: '600', color: COLORS.gray400, textAlign: 'center' },

  // Error
  errorCard: {
    backgroundColor: COLORS.amberBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: COLORS.blue, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  retryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  // Manual Entry
  manualCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  manualTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  manualHint: { fontSize: 13, color: COLORS.gray400, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.dark,
  },
  continueButton: { backgroundColor: COLORS.blue, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.4 },
  continueButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  // Bottom
  bottomBar: { padding: 20, paddingBottom: Platform.OS === 'android' ? 24 : 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  cancelButton: { backgroundColor: COLORS.gray100, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  cancelButtonText: { color: COLORS.dark, fontSize: 15, fontWeight: '700' },
});
