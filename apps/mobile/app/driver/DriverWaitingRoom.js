import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { useMatching } from "../../context/MatchingContext";
import Svg, { Path, Circle } from "react-native-svg";
import RiderIllustration from "../../components/RiderIllustration";

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
  if (!timeStr || !TIME_RE.test(String(timeStr).trim())) return "—";
  const [h, m] = String(timeStr).trim().split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function DriverWaitingRoom() {
  const router = useRouter();
  const { connect, send, disconnect, onMessage } = useMatching();

  const params = useLocalSearchParams();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  const matchMode = Array.isArray(params.matchMode)
    ? params.matchMode[0]
    : params.matchMode;
  const time = Array.isArray(params.time) ? params.time[0] : params.time;
<<<<<<< HEAD
  const classStartTime = Array.isArray(params.classStartTime) ? params.classStartTime[0] : params.classStartTime;
  const pickupTime = Array.isArray(params.pickupTime) ? params.pickupTime[0] : params.pickupTime;
  const classStart = Array.isArray(params.classStart) ? params.classStart[0] : params.classStart;
  const classEnd = Array.isArray(params.classEnd) ? params.classEnd[0] : params.classEnd;
  
=======
  const pickupTime = Array.isArray(params.pickupTime)
    ? params.pickupTime[0]
    : params.pickupTime;
  const classStart = Array.isArray(params.classStart)
    ? params.classStart[0]
    : params.classStart;
  const classEnd = Array.isArray(params.classEnd)
    ? params.classEnd[0]
    : params.classEnd;

>>>>>>> origin/main
  const isManualEntry = matchMode === "manual";

  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [offlineHovered, setOfflineHovered] = useState(false);

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

    async function setup() {
      const result = isManualEntry
<<<<<<< HEAD
        ? await connect({ location: from, time: classStartTime || time })
=======
        ? await connect({ location: from, time })
>>>>>>> origin/main
        : await connect();

      if (result?.ok && result.userId) {
        send({ type: "driver_online", driver_id: result.userId });
        setConnected(true);
        setStatusMessage("");
      } else if (result?.needsManualTime) {
        setStatusMessage(result.message || "No class block found for today.");
      } else if (result?.error) {
        setStatusMessage(result.error);
      } else {
        setStatusMessage("Unable to go online right now.");
      }

      unsubscribe = onMessage((msg) => {
<<<<<<< HEAD
        if (msg.type === "rider_joined" || msg.type === "initial_state") {
=======
        const hasRiders =
          msg.type === "rider_joined" ||
          (msg.type === "initial_state" &&
            Array.isArray(msg.riders) &&
            msg.riders.length > 0);
        if (hasRiders) {
>>>>>>> origin/main
          router.replace({
            pathname: "/driver/AvailableRiders",
            params: {
              from,
              pickupTime: isManualEntry ? time : pickupTime,
              classStart,
              classEnd,
              to,
              matchMode,
            },
          });
        }
      });
    }

    setup();
    return () => unsubscribe?.();
  }, []);

  function handleGoOffline() {
    disconnect();
    router.replace("/driver/OfferRide");
  }

<<<<<<< HEAD
  const effectivePickupTime = isManualEntry ? time : pickupTime;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoOffline} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RIDE OFFERED</Text>
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
              <Text style={styles.cardLabel}>PICK UP AT</Text>
              <Text style={styles.cardValue} numberOfLines={1}>{from || "—"}</Text>
            </View>
          </View>

          {isManualEntry && to ? (
            <>
              <View style={styles.timelineConnector} />
              <View style={styles.cardRow}>
                <View style={styles.iconWrap}>
                  <View style={styles.timelineDotSquare} />
                </View>
                <View style={styles.cardRowContent}>
                  <Text style={styles.cardLabel}>DESTINATION</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>{to}</Text>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.cardDivider} />

          <View style={styles.cardRow}>
            <View style={styles.iconWrap}>
              <ClockIcon size={16} color={COLORS.blue} />
            </View>
            <View style={styles.cardRowContent}>
              <Text style={styles.cardLabel}>PICKUP TIME</Text>
              <Text style={[styles.cardValue, { color: COLORS.blue }]}>
                {formatTime12h(effectivePickupTime)}
              </Text>
            </View>
          </View>

          {!isManualEntry ? (
            <>
              <View style={styles.cardDivider} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.infoBox, { flex: 1 }]}>
                  <Text style={styles.infoBoxLabel}>CLASS STARTS</Text>
                  <Text style={styles.infoBoxValue}>{formatTime12h(classStart)}</Text>
                </View>
                <View style={[styles.infoBox, { flex: 1 }]}>
                  <Text style={styles.infoBoxLabel}>CLASS END</Text>
                  <Text style={styles.infoBoxValue}>{formatTime12h(classEnd)}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Connection Status */}
        {connected && (
          <View style={styles.statusPill}>
            <Animated.View style={[styles.greenDotOuter, { transform: [{ scale: greenPulse }] }]}>
              <View style={styles.greenDot} />
            </Animated.View>
            <Text style={styles.statusPillText}>Online — Waiting for riders</Text>
          </View>
        )}

        {!connected && statusMessage ? (
          <View style={styles.errorPill}>
            <Text style={styles.errorPillText}>{statusMessage}</Text>
          </View>
        ) : null}

        {/* Animation Loader */}
        {!statusMessage && (
          <View style={styles.loaderSection}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <RiderIllustration isHovered={true} />
            </View>
            <Text style={styles.loaderText}>
              {connected ? "Waiting for riders to request a ride..." : "Connecting to matching..."}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[
            styles.offlineButton, 
            offlineHovered && styles.offlineButtonHovered
          ]} 
          onPress={handleGoOffline} 
          activeOpacity={0.85}
          onHoverIn={() => setOfflineHovered(true)}
          onHoverOut={() => setOfflineHovered(false)}
          onPressIn={() => setOfflineHovered(true)}
          onPressOut={() => setOfflineHovered(false)}
        >
          <Text style={[
            styles.offlineButtonText, 
            offlineHovered && styles.offlineButtonTextHovered
          ]}>
            Go Offline
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
=======
  const statusLabel = connected
    ? "Live and waiting"
    : statusMessage
      ? "Offline"
      : "Connecting";

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleGoOffline}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleGoOffline}
          style={styles.offlineChip}
          activeOpacity={0.82}
        >
          <Text style={styles.offlineChipText}>Go offline</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>Driver queue</Text>
        <Text style={styles.heroTitle}>Ride offer is live</Text>
        <Text style={styles.heroBody}>
          Riders matching this pickup window will appear here as soon as the room receives
          activity.
        </Text>

        <View style={styles.statusPill}>
          {connected ? <View style={styles.liveDot} /> : null}
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Offer summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pickup point</Text>
          <Text style={styles.summaryValue}>{from || "—"}</Text>
        </View>
        {isManualEntry && to ? (
          <>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Destination</Text>
              <Text style={styles.summaryValue}>{to}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pickup time</Text>
          <Text style={styles.summaryValue}>
            {formatTime12h(isManualEntry ? time : pickupTime)}
          </Text>
        </View>
        {!isManualEntry ? (
          <>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class starts</Text>
              <Text style={styles.summaryValue}>{formatTime12h(classStart)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class ends</Text>
              <Text style={styles.summaryValue}>{formatTime12h(classEnd)}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.signalCard}>
        {connected ? (
          <>
            <ActivityIndicator size="small" color="#1a4a37" />
            <Text style={styles.signalTitle}>Listening for riders now</Text>
            <Text style={styles.signalBody}>
              The screen will automatically move you to the rider queue as soon as someone
              joins this offer.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.signalTitle}>Unable to go online</Text>
            <Text style={styles.signalBody}>
              {statusMessage || "Connecting to matching service."}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGoOffline}
        activeOpacity={0.86}
      >
        <Text style={styles.primaryButtonText}>
          {connected ? "Stop offering this ride" : "Leave this screen"}
        </Text>
      </TouchableOpacity>
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
  infoBox: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.gray100 },
  infoBoxLabel: { fontSize: 9, fontWeight: '700', color: COLORS.gray400, letterSpacing: 1, marginBottom: 4 },
  infoBoxValue: { fontSize: 14, fontWeight: '900', color: COLORS.dark },

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

  // Error
  errorPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorPillText: { fontSize: 13, color: '#991B1B', lineHeight: 18 },

  // Loader
  loaderSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { fontSize: 14, fontWeight: '600', color: COLORS.gray400, textAlign: 'center' },

  // Bottom Bar
  bottomBar: { padding: 20, paddingBottom: Platform.OS === 'android' ? 24 : 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  offlineButton: { 
    backgroundColor: COLORS.gray100, 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({ web: { transition: 'all 0.2s' }, default: {} })
  },
  offlineButtonHovered: { 
    backgroundColor: '#FEF2F2', 
    borderColor: '#FCA5A5' 
  },
  offlineButtonText: { color: COLORS.dark, fontSize: 15, fontWeight: '700' },
  offlineButtonTextHovered: { color: '#DC2626' },
=======
  screen: {
    flex: 1,
    backgroundColor: "#f2efe7",
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
    backgroundColor: "#e6e0d2",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#44574e",
  },
  offlineChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#d8cebe",
  },
  offlineChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#44574e",
  },
  heroCard: {
    backgroundColor: "#1c4d38",
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
    backgroundColor: "#35644f",
    top: -58,
    right: -28,
    opacity: 0.46,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#d4e2da",
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
    color: "#d5e2d9",
    maxWidth: "93%",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 249, 239, 0.14)",
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7fd490",
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff9ef",
  },
  summaryCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e4dacb",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1c4d38",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6f8278",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#20352d",
  },
  divider: {
    height: 1,
    backgroundColor: "#ece3d6",
  },
  signalCard: {
    backgroundColor: "#fbf7ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e4dacb",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  signalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1c4d38",
    textAlign: "center",
  },
  signalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#647970",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#1c4d38",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 20,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff9ef",
  },
>>>>>>> origin/main
});
