import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Path, Circle } from 'react-native-svg';

const ClockIcon = ({ size = 16, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const HistoryLineIcon = ({ size = 16, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
    <Path d="M12 7v5l4 2" />
  </Svg>
);

const SearchLineIcon = ({ size = 16, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

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
  amber: '#D97706',
  amberBg: '#FFFBEB',
  red: '#DC2626',
  redBg: '#FEF2F2',
};

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const formatRideDate = (dateInput) => {
  if (!dateInput) return "Today";
  const rideDate = new Date(dateInput);
  
  // Adjust for timezone to avoid parsing offset off-by-one errors for just YYYY-MM-DD
  const localDate = new Date(rideDate.getTime() + rideDate.getTimezoneOffset() * 60000);
  
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(localDate, today)) return 'Today';
  if (isSameDay(localDate, tomorrow)) return 'Tomorrow';

  return localDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const StatusBadge = ({ status }) => {
  const isPending = status === 'Finding Driver';
  const isCompleted = status === 'Completed';

  const bgColor = isPending
    ? COLORS.amberBg
    : isCompleted
    ? COLORS.gray100
    : '#EFF6FF';

  const textColor = isPending
    ? COLORS.amber
    : isCompleted
    ? COLORS.gray400
    : COLORS.blue;

  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusBadgeText, { color: textColor }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
};

const Timeline = ({ pickup, destination, compact }) => (
  <View style={styles.timelineContainer}>
    <View style={styles.timelineLine} />
    <View style={styles.timelineRow}>
      <View style={styles.timelineDotCircle} />
      <Text style={[styles.timelineText, compact && styles.timelineTextCompact]} numberOfLines={1}>
        {pickup}
      </Text>
    </View>
    <View style={[styles.timelineRow, { marginTop: compact ? 20 : 32 }]}>
      <View style={styles.timelineDotSquare} />
      <Text style={[styles.timelineText, compact && styles.timelineTextCompact]} numberOfLines={1}>
        {destination}
      </Text>
    </View>
  </View>
);

const InfoBox = ({ label, value, accent }) => (
  <View style={styles.infoBox}>
    <Text style={styles.infoBoxLabel}>{label.toUpperCase()}</Text>
    <Text style={[styles.infoBoxValue, accent && { color: COLORS.blue }]}>{value}</Text>
  </View>
);

const RideCard = ({ ride, onPress, isFirstOfUpcoming }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={[styles.card, isFirstOfUpcoming ? styles.cardBottomRounded : styles.cardFullRounded]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>
            {formatRideDate(ride.timestamp).toUpperCase()}
          </Text>
        </View>
        <StatusBadge status={ride.status} />
      </View>

      <View style={styles.infoRow}>
        <InfoBox label="Pick up time" value={ride.pickupTime} accent />
        <View style={{ width: 10 }} />
        <InfoBox label="Arrival" value={ride.classTime} />
      </View>

      <Timeline pickup={ride.pickup} destination={ride.destination} compact />

      <View style={styles.cardFooter}>
        {ride.driver ? (
          <View style={styles.driverRow}>
            {ride.driver.image ? (
              <Image source={{ uri: ride.driver.image }} style={styles.driverAvatar} />
            ) : (
              <View style={[styles.driverAvatar, { backgroundColor: COLORS.gray200 }]} />
            )}
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.driverLabel}>DRIVER</Text>
              <Text style={styles.driverName}>{ride.driver.name}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.driverRow}>
            <Text style={styles.assigningText}>⚠ Assigning...</Text>
          </View>
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

const RideDetail = ({ ride, onBack }) => {
  const isCompleted = ride.status === 'Completed';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.detailHeaderTitle}>RIDE DETAILS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailCard}>
          <View style={styles.infoRow}>
            <InfoBox label="Pick up time" value={ride.pickupTime} accent />
            <View style={{ width: 10 }} />
            <InfoBox label="Arrival" value={ride.classTime} />
          </View>

          <View style={{ marginTop: 24 }}>
            <Timeline pickup={ride.pickup} destination={ride.destination} />
          </View>
        </View>

        {ride.driver && (
          <View style={styles.detailCard}>
            <View style={styles.detailDriverRow}>
              <View style={styles.driverInfo}>
                {ride.driver.image ? (
                  <Image source={{ uri: ride.driver.image }} style={styles.detailDriverAvatar} />
                ) : (
                  <View style={[styles.detailDriverAvatar, { backgroundColor: COLORS.gray200 }]} />
                )}
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.detailDriverName}>{ride.driver.name}</Text>
                  <Text style={styles.detailDriverCar}>{ride.driver.car}</Text>
                </View>
              </View>
              <View style={styles.platePill}>
                <Text style={styles.platePillLabel}>PLATE</Text>
                <Text style={styles.platePillValue}>{ride.driver.plate}</Text>
              </View>
            </View>
          </View>
        )}

        {isCompleted ? (
          <TouchableOpacity style={styles.actionButtonDark} activeOpacity={0.85}>
            <Text style={styles.actionButtonDarkText}>Schedule Again</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionButtonRed} activeOpacity={0.85}>
            <Text style={styles.actionButtonRedText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default function ScheduledRidesRider() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab || 'upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [upcomingRides, setUpcomingRides] = useState([]);
  const [historyRides, setHistoryRides] = useState([]);

  useEffect(() => {
    loadRides('upcoming');
    loadRides('history');
  }, []);

  async function loadRides(type) {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      if (!BACKEND_URL) return;

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const isHistory = type === 'history';
      const url = `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(String(user.id))}${isHistory ? '&history=true' : ''}`;
      
      const res = await fetch(url);
      if (!res.ok) return;
      
      const payload = await res.json();
      const ridesData = payload?.rides ?? [];

      const enriched = ridesData.map((ride) => {
        // Calculate approx arrival +10 mins for display
        let classTime = "—";
        if (ride.start_time) {
          const [h, m] = ride.start_time.split(":").map(Number);
          const endM = (m + 10) % 60;
          const endH = h + Math.floor((m + 10) / 60);
          classTime = formatTime12h(`${endH}:${endM}`);
        }

        return {
          id: ride.id,
          timestamp: ride.ride_date || new Date().toISOString(),
          pickupTime: formatTime12h(ride.start_time),
          classTime: classTime,
          pickup: ride.pickup_loc || ride.location || "Unknown",
          destination: ride.dropoff_loc || "Augustana College",
          driver: ride.driver ? {
            name: ride.driver.name || "Unknown",
            image: ride.driver.picture_url || null,
            car: ride.car ? `${ride.car.color || ''} ${ride.car.make || ''} ${ride.car.model || ''}`.trim() : "Unknown Car",
            plate: ride.car?.license_plate || "N/A",
          } : null,
          status: ride.status === 'completed' ? 'Completed' : 'Confirmed',
        };
      });

      if (isHistory) {
        setHistoryRides(enriched);
      } else {
        setUpcomingRides(enriched);
      }
    } catch (_) {
    } finally {
      if (type === 'upcoming') setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  if (selectedRide) {
    return <RideDetail ride={selectedRide} onBack={() => setSelectedRide(null)} />;
  }

  const currentRides = activeTab === 'upcoming' ? upcomingRides : historyRides;

  const filteredRides = currentRides.filter((r) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    return (
      (r.driver?.name || "").toLowerCase().includes(s) ||
      (r.pickup || "").toLowerCase().includes(s) ||
      (r.destination || "").toLowerCase().includes(s)
    );
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Rides</Text>
          <TouchableOpacity onPress={() => router.replace("/rider/RequestRide")} style={styles.getRideButton} activeOpacity={0.85}>
            <Text style={styles.getRideButtonText}>Get a Ride  +</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrapper}>
          <SearchLineIcon size={16} color={COLORS.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rides..."
            placeholderTextColor={COLORS.gray300}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tabRow}>
          {['upcoming', 'history'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              activeOpacity={0.8}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                {tab === 'upcoming' 
                  ? <ClockIcon size={14} color={activeTab === tab ? COLORS.white : COLORS.gray400} /> 
                  : <HistoryLineIcon size={14} color={activeTab === tab ? COLORS.white : COLORS.gray400} />}
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'upcoming' && filteredRides.length > 0 ? (
          <View>
            <View style={styles.nextRideBanner}>
              <View>
                <Text style={styles.nextRideBannerLabel}>NEXT RIDE</Text>
                <Text style={styles.nextRideBannerDate}>
                  {formatRideDate(filteredRides[0].timestamp)}
                </Text>
              </View>
              <Text style={styles.nextRideBannerTime}>
                Pick up: {filteredRides[0].pickupTime}
              </Text>
            </View>

            <RideCard
              ride={filteredRides[0]}
              onPress={() => setSelectedRide(filteredRides[0])}
              isFirstOfUpcoming
            />

            <View style={{ marginTop: 16 }}>
              {filteredRides.slice(1).map((ride) => (
                <View key={ride.id} style={{ marginBottom: 12 }}>
                  <RideCard ride={ride} onPress={() => setSelectedRide(ride)} />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            {filteredRides.length > 0 ? (
              filteredRides.map((ride) => (
                <View key={ride.id} style={{ marginBottom: 12 }}>
                  <RideCard ride={ride} onPress={() => setSelectedRide(ride)} />
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No rides found</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 12 : 12,
    paddingBottom: 10,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 16, alignItems: 'center', marginBottom: 10, paddingRight: 48 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.dark, letterSpacing: -0.5 },
  getRideButton: { backgroundColor: COLORS.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  getRideButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark, padding: 0, outlineStyle: 'none' },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: COLORS.dark },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'capitalize' },
  tabTextActive: { color: COLORS.white },
  scrollContent: { padding: 16, paddingBottom: 40 },
  nextRideBanner: { backgroundColor: COLORS.blue, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextRideBannerLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  nextRideBannerDate: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginTop: 2 },
  nextRideBannerTime: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  card: { backgroundColor: COLORS.white, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.gray100 },
  cardBottomRounded: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  cardFullRounded: { borderRadius: 20 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  datePill: { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  datePillText: { fontSize: 10, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  infoRow: { flexDirection: 'row', marginBottom: 14 },
  infoBox: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.gray100 },
  infoBoxLabel: { fontSize: 9, fontWeight: '700', color: COLORS.gray400, letterSpacing: 1, marginBottom: 4 },
  infoBoxValue: { fontSize: 14, fontWeight: '900', color: COLORS.dark },
  timelineContainer: { paddingLeft: 28, position: 'relative' },
  timelineLine: { position: 'absolute', left: 6, top: 6, bottom: 6, width: 1, borderLeftWidth: 1, borderLeftColor: COLORS.gray200, borderStyle: 'dashed' },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
  timelineDotCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.blue, position: 'absolute', left: -22, zIndex: 1 },
  timelineDotSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: COLORS.dark, position: 'absolute', left: -22, zIndex: 1 },
  timelineText: { fontSize: 14, fontWeight: '600', color: '#475569', flex: 1 },
  timelineTextCompact: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 32, height: 32, borderRadius: 10 },
  driverLabel: { fontSize: 9, fontWeight: '700', color: COLORS.gray400, letterSpacing: 1 },
  driverName: { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  assigningText: { fontSize: 12, fontWeight: '700', color: COLORS.gray300 },
  chevron: { fontSize: 24, color: COLORS.gray200, lineHeight: 26 },
  emptyState: { paddingVertical: 64, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: COLORS.gray300 },
  detailHeader: { backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  backChevron: { fontSize: 28, color: COLORS.dark, lineHeight: 30 },
  detailHeaderTitle: { fontSize: 12, fontWeight: '800', color: COLORS.dark, letterSpacing: 2 },
  detailContent: { padding: 20, paddingBottom: 40 },
  detailCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.gray100 },
  detailDriverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  detailDriverAvatar: { width: 48, height: 48, borderRadius: 14 },
  detailDriverName: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  detailDriverCar: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  platePill: { backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray100 },
  platePillLabel: { fontSize: 8, fontWeight: '700', color: COLORS.gray400, letterSpacing: 1, marginBottom: 2 },
  platePillValue: { fontSize: 12, fontWeight: '900', color: COLORS.dark },
  actionButtonDark: { backgroundColor: COLORS.dark, borderRadius: 18, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.dark, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  actionButtonDarkText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  actionButtonRed: { backgroundColor: COLORS.redBg, borderRadius: 18, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  actionButtonRedText: { color: COLORS.red, fontSize: 14, fontWeight: '700' },
});
