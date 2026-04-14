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
  Alert,
} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";

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

  const bgColor = isPending ? COLORS.amberBg : isCompleted ? COLORS.gray100 : '#EFF6FF';
  const textColor = isPending ? COLORS.amber : isCompleted ? COLORS.gray400 : COLORS.blue;

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

const RideCard = ({ group, onPress, isFirstOfUpcoming }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={[styles.card, isFirstOfUpcoming ? styles.cardBottomRounded : styles.cardFullRounded]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>
            {formatRideDate(group.timestamp).toUpperCase()}
          </Text>
        </View>
        <StatusBadge status={group.status} />
      </View>

      <View style={styles.infoRow}>
        <InfoBox label="Pick up time" value={group.pickupTime} accent />
        <View style={{ width: 10 }} />
        <InfoBox label="Arrival" value={group.classTime} />
      </View>

      <Timeline pickup={group.pickup} destination={group.destination} compact />

      <View style={styles.cardFooter}>
        <View style={styles.driverRow}>
          {group.riders.length > 0 && group.riders[0].image ? (
            <Image source={{ uri: group.riders[0].image }} style={styles.driverAvatar} />
          ) : (
            <View style={[styles.driverAvatar, { backgroundColor: COLORS.gray200 }]} />
          )}
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.driverLabel}>RIDERS</Text>
            <Text style={styles.driverName}>
              {group.riders.length} {group.riders.length === 1 ? 'rider' : 'riders'} 
              {group.riders.length > 0 ? ` • ${group.riders.map(r => r.name.split(' ')[0]).join(', ')}` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

const RideDetail = ({ group, onBack, onComplete, completingKey }) => {
  const isCompleted = group.status === 'Completed';
  const isCompleting = completingKey === group.key;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.detailHeaderTitle}>ROUTE DETAILS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailCard}>
          <View style={styles.infoRow}>
            <InfoBox label="Pick up time" value={group.pickupTime} accent />
            <View style={{ width: 10 }} />
            <InfoBox label="Arrival" value={group.classTime} />
          </View>

          <View style={{ marginTop: 24 }}>
            <Timeline pickup={group.pickup} destination={group.destination} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>PASSENGERS</Text>
        <View style={{ gap: 12, marginBottom: 24 }}>
          {group.riders.map((rider, i) => (
            <View key={i} style={styles.detailCardNoMarg}>
              <View style={styles.detailDriverRow}>
                <View style={styles.driverInfo}>
                  {rider.image ? (
                    <Image source={{ uri: rider.image }} style={styles.detailDriverAvatar} />
                  ) : (
                    <View style={[styles.detailDriverAvatar, { backgroundColor: COLORS.gray200 }]} />
                  )}
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.detailDriverName}>{rider.name || 'Unknown'}</Text>
                    <Text style={styles.detailDriverCar}>{rider.residence || 'No location given'}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {!isCompleted && group.rideIds?.length > 0 && (
          <TouchableOpacity 
            style={[styles.actionButtonBlue, isCompleting && { opacity: 0.7 }]} 
            activeOpacity={0.85}
            onPress={() => onComplete(group.key, group.rideIds)}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.actionButtonDarkText}>Complete Route</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default function ScheduledRidesDriver() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab || 'upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [upcomingGroups, setUpcomingGroups] = useState([]);
  const [historyGroups, setHistoryGroups] = useState([]);
  const [completingKey, setCompletingKey] = useState(null);

  useEffect(() => {
    loadRides('upcoming');
    loadRides('history');
  }, []);

  function groupRidesMapping(rides, type) {
    const map = new Map();
    for (const ride of rides) {
      // Create a unique key per timeslot
      const key = `${ride.ride_date || ride.day}|${ride.start_time}`;
      if (!map.has(key)) {
        let classTime = "—";
        if (ride.start_time) {
          const [h, m] = ride.start_time.split(":").map(Number);
          const endM = (m + 10) % 60;
          const endH = h + Math.floor((m + 10) / 60);
          classTime = formatTime12h(`${endH}:${endM}`);
        }

        map.set(key, {
          key,
          id: key, // for rendering loop
          timestamp: ride.ride_date || new Date().toISOString(),
          pickupTime: formatTime12h(ride.start_time),
          classTime: classTime,
          pickup: ride.pickup_loc || ride.location || "Unknown Pickup",
          destination: ride.dropoff_loc || "Augustana College",
          status: type === 'history' || ride.status === 'completed' ? 'Completed' : 'Confirmed',
          riders: [],
          rideIds: [],
        });
      }
      const g = map.get(key);
      if (ride.rider) {
        g.riders.push({
          name: ride.rider.name,
          image: ride.rider.picture_url,
          residence: ride.rider.residence,
        });
      }
      if (ride.id) g.rideIds.push(String(ride.id));
    }
    // Sort logic handled natively
    return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async function loadRides(type) {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      if (!BACKEND_URL) return;

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const isHistory = type === 'history';
      const url = `${normalizedBackendUrl}/api/driver/rides?driver_id=${encodeURIComponent(String(user.id))}${isHistory ? '&history=true' : ''}`;
      
      const res = await fetch(url);
      if (!res.ok) return;
      
      const payload = await res.json();
      const ridesData = payload?.rides ?? [];

      const grouped = groupRidesMapping(ridesData, type);

      if (isHistory) {
        setHistoryGroups(grouped);
      } else {
        setUpcomingGroups(grouped);
      }
    } catch (_) {
    } finally {
      if (type === 'upcoming') setLoading(false);
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
        headers: { "Content-Type": "application/json", "x-user-id": String(user.id) },
        body: JSON.stringify({ ride_ids: rideIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Could not complete ride", payload?.error || "Try again.");
        return;
      }
      
      // If success, we should refresh both lists and close detail
      setSelectedRide(null);
      await Promise.all([loadRides('upcoming'), loadRides('history')]);
      
    } catch {
      Alert.alert("Error", "Could not complete the route. Please try again.");
    } finally {
      setCompletingKey(null);
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
    return (
      <RideDetail 
        group={selectedRide} 
        onBack={() => setSelectedRide(null)} 
        onComplete={completeRides} 
        completingKey={completingKey} 
      />
    );
  }

  const currentGroups = activeTab === 'upcoming' ? upcomingGroups : historyGroups;

  const filteredGroups = currentGroups.filter((g) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    const matchesRider = g.riders.some(r => (r.name || "").toLowerCase().includes(s));
    return (
      matchesRider ||
      (g.pickup || "").toLowerCase().includes(s) ||
      (g.destination || "").toLowerCase().includes(s)
    );
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Routes</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search routes or riders..."
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
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'upcoming' ? '🕐 ' : '🕰 '}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'upcoming' && filteredGroups.length > 0 ? (
          <View>
            <View style={styles.nextRideBanner}>
              <View>
                <Text style={styles.nextRideBannerLabel}>NEXT ROUTE</Text>
                <Text style={styles.nextRideBannerDate}>
                  {formatRideDate(filteredGroups[0].timestamp)}
                </Text>
              </View>
              <Text style={styles.nextRideBannerTime}>
                Pick up: {filteredGroups[0].pickupTime}
              </Text>
            </View>

            <RideCard
              group={filteredGroups[0]}
              onPress={() => setSelectedRide(filteredGroups[0])}
              isFirstOfUpcoming
            />

            <View style={{ marginTop: 16 }}>
              {filteredGroups.slice(1).map((group) => (
                <View key={group.id} style={{ marginBottom: 12 }}>
                  <RideCard group={group} onPress={() => setSelectedRide(group)} />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <View key={group.id} style={{ marginBottom: 12 }}>
                  <RideCard group={group} onPress={() => setSelectedRide(group)} />
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🧭</Text>
                <Text style={styles.emptyText}>No routes found</Text>
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
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.dark, letterSpacing: -0.5 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 14, color: COLORS.dark, fontWeight: '800' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 16 },
  searchIcon: { fontSize: 14, marginRight: 8 },
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
  chevron: { fontSize: 24, color: COLORS.gray200, lineHeight: 26 },
  emptyState: { paddingVertical: 64, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 32, opacity: 0.3 },
  emptyText: { fontSize: 14, fontWeight: '700', color: COLORS.gray300 },
  detailHeader: { backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  backChevron: { fontSize: 28, color: COLORS.dark, lineHeight: 30 },
  detailHeaderTitle: { fontSize: 12, fontWeight: '800', color: COLORS.dark, letterSpacing: 2 },
  detailContent: { padding: 20, paddingBottom: 40 },
  detailCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.gray100 },
  detailCardNoMarg: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.gray100 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: COLORS.gray400, letterSpacing: 2, marginLeft: 8, marginBottom: 8 },
  detailDriverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  detailDriverAvatar: { width: 48, height: 48, borderRadius: 14 },
  detailDriverName: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  detailDriverCar: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  actionButtonBlue: { backgroundColor: COLORS.blue, borderRadius: 18, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.blue, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  actionButtonDarkText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
