import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useMatching } from "../../context/MatchingContext";
import {
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
  amber: '#F59E0B',
  amberBg: '#FFFBEB',
};

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const BackIcon = ({ size = 20, color = COLORS.dark }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" />
    <Path d="M12 19l-7-7 7-7" />
  </Svg>
);

const UserIcon = ({ size = 18, color = COLORS.blue }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
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

// ─── Animated Car Loader ────────────────────────────────────────────────────
function CarLoader({ label }) {
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
        <CarSvg size={56} color={COLORS.blue} />
      </Animated.View>
      <View style={styles.roadLine} />
      <View style={styles.dotsRow}>
        {[dotScale1, dotScale2, dotScale3].map((dot, i) => (
          <Animated.View key={i} style={[styles.loaderDot, { transform: [{ scale: dot }] }]} />
        ))}
      </View>
      {label && <Text style={styles.loaderText}>{label}</Text>}
    </View>
  );
}

// ─── Rider Card ─────────────────────────────────────────────────────────────
function RiderCard({ rider, isPending, onPress, index }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, delay: index * 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        style={[styles.riderCard, isPending && styles.riderCardPending]}
        onPress={onPress}
        activeOpacity={isPending ? 1 : 0.85}
        disabled={isPending}
      >
        <View style={styles.riderCardInner}>
          {rider.picture_url ? (
            <Image source={{ uri: rider.picture_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {rider.name ? rider.name[0].toUpperCase() : "?"}
              </Text>
            </View>
          )}

          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{rider.name ?? "Unknown Rider"}</Text>
            {rider.to_location ? (
              <Text style={styles.riderMeta} numberOfLines={1}>To: {rider.to_location}</Text>
            ) : null}
            {rider.rating != null && (
              <Text style={styles.riderRating}>★ {rider.rating.toFixed(1)}</Text>
            )}
          </View>

          {isPending ? (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingPillText}>Waiting...</Text>
            </View>
          ) : (
            <View style={styles.selectPill}>
              <Text style={styles.selectPillText}>Select</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AvailableRidersScreen() {
  const router = useRouter();
  const { send, onMessage, userId, disconnect, getRidersSnapshot } = useMatching();
  const [riders, setRiders] = useState([]);
  const [pendingRiderIds, setPendingRiderIds] = useState(new Set());
  const [capacity, setCapacity] = useState(4);
  const [seatsUsed, setSeatsUsed] = useState(0);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const greenPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();

    // Green dot pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(greenPulse, { toValue: 1.5, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(greenPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    // Fetch car capacity
    if (userId) {
      fetch(
        `${SUPABASE_URL}/rest/v1/Car?user_id=eq.${userId}&select=capacity`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      )
        .then((r) => r.json())
        .then((data) => {
          const raw = data?.[0]?.capacity;
          const parsed = typeof raw === "number" ? raw : Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) {
            setCapacity(parsed);
          }
        })
        .catch(() => {});
    }

    // Seed from snapshot
    setRiders(getRidersSnapshot?.() ?? []);

    const unsubscribe = onMessage((msg) => {
      if (msg.type === "initial_state") setRiders(msg.riders ?? []);
      if (msg.type === "rider_joined") {
        setRiders((prev) => {
          if (prev.some((r) => r.rider_id === msg.rider?.rider_id)) return prev;
          return [...prev, msg.rider];
        });
      }
      if (msg.type === "rider_removed") {
        setRiders((prev) => prev.filter((r) => r.rider_id !== msg.rider_id));
        setPendingRiderIds((prev) => { const s = new Set(prev); s.delete(msg.rider_id); return s; });
      }
      if (msg.type === "match_rejected" && msg.driver_id === userId) {
        setPendingRiderIds((prev) => {
          const s = new Set(prev);
          s.delete(msg.rider_id);
          return s;
        });
      }
      if (msg.type === "seat_update" && msg.driver_id === userId) {
        if (typeof capacity === "number") {
          const nextUsed = Math.max(0, capacity - (msg.seats_remaining ?? capacity));
          setSeatsUsed(nextUsed);
        }
      }
      if (msg.type === "match_confirmed") {
        setSeatsUsed((prev) => prev + 1);
        setPendingRiderIds((prev) => { const s = new Set(prev); s.delete(msg.rider?.id); return s; });
        router.push("/driver/ScheduledRidesDriver");
      }
    });

    return () => unsubscribe?.();
  }, [userId]);

  function handleSelectRider(rider) {
    if (pendingRiderIds.has(rider.rider_id)) return;

    if (capacity !== null && (seatsUsed + pendingRiderIds.size) >= capacity) {
      Alert.alert("Car Full", "Car seat capacity reached.");
      return;
    }

    send({ type: "select_rider", driver_id: userId, rider_id: rider.rider_id });
    setPendingRiderIds((prev) => new Set(prev).add(rider.rider_id));
  }

  function handleGoOffline() {
    disconnect();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  const seatsRemaining = Math.max(0, capacity - seatsUsed - pendingRiderIds.size);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoOffline} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AVAILABLE RIDERS</Text>
        <TouchableOpacity
          onPress={() => router.push("/driver/ScheduledRidesDriver")}
          style={styles.ridesButton}
          activeOpacity={0.85}
        >
          <Text style={styles.ridesButtonText}>Rides</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Status Row */}
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Animated.View style={[styles.greenDotOuter, { transform: [{ scale: greenPulse }] }]}>
              <View style={styles.greenDot} />
            </Animated.View>
            <Text style={styles.statusPillText}>Online</Text>
          </View>

          <View style={styles.seatsPill}>
            <UserIcon size={14} color={COLORS.blue} />
            <Text style={styles.seatsPillText}>
              {seatsUsed} / {capacity} seats
            </Text>
          </View>
        </View>

        {/* Rider List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {riders.length === 0 ? (
            <View style={styles.emptySection}>
              <CarLoader label="Waiting for riders..." />
            </View>
          ) : (
            riders.map((rider, i) => (
              <RiderCard
                key={rider.rider_id}
                rider={rider}
                index={i}
                isPending={pendingRiderIds.has(rider.rider_id)}
                onPress={() => handleSelectRider(rider)}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.offlineButton} onPress={handleGoOffline} activeOpacity={0.85}>
          <Text style={styles.offlineButtonText}>Go Offline</Text>
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
  headerTitle: { fontSize: 12, fontWeight: '800', color: COLORS.dark, letterSpacing: 2 },
  ridesButton: { backgroundColor: COLORS.blue, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  ridesButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  content: { flex: 1, padding: 16 },

  // Status Row
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  greenDotOuter: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  seatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  seatsPillText: { fontSize: 12, fontWeight: '700', color: COLORS.dark },

  // Scroll
  scrollContent: { gap: 12, paddingBottom: 24 },

  // Rider Card
  riderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  riderCardPending: {
    opacity: 0.7,
    backgroundColor: '#F0F4FF',
    borderColor: '#C7D2FE',
  },
  riderCardInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 16 },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: COLORS.blue },
  riderInfo: { flex: 1, gap: 2 },
  riderName: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  riderMeta: { fontSize: 13, color: COLORS.gray400 },
  riderRating: { fontSize: 13, color: COLORS.amber, fontWeight: '700' },
  selectPill: { backgroundColor: COLORS.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  selectPillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  pendingPill: { backgroundColor: COLORS.amberBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#FCD34D' },
  pendingPillText: { color: COLORS.amber, fontSize: 11, fontWeight: '700' },

  // Empty
  emptySection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  // Car Loader
  carLoaderWrap: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  roadLine: { width: 180, height: 2, backgroundColor: COLORS.gray200, borderRadius: 1 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  loaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue },
  loaderText: { fontSize: 14, fontWeight: '600', color: COLORS.gray400, textAlign: 'center' },

  // Bottom Bar
  bottomBar: { padding: 20, paddingBottom: Platform.OS === 'android' ? 24 : 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  offlineButton: { backgroundColor: COLORS.gray100, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  offlineButtonText: { color: COLORS.dark, fontSize: 15, fontWeight: '700' },
});
