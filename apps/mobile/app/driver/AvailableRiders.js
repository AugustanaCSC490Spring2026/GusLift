import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useMatching } from "../../context/MatchingContext";
import RouteMap from "../../components/RouteMap";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function RiderCard({ rider, isPending, isRejected, onPress }) {
  const disabled = isPending || isRejected;
  const buttonLabel = isRejected
    ? "Rejected"
    : isPending
      ? "Waiting..."
      : "Select";

  return (
    <View
      style={[
        styles.card,
        isPending && styles.cardPending,
        isRejected && styles.cardRejected,
      ]}
    >
      {rider.picture_url ? (
        <Image source={{ uri: rider.picture_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>
            {rider.name ? rider.name[0].toUpperCase() : "?"}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name}>{rider.name ?? "Unknown rider"}</Text>
        {isRejected ? (
          <Text style={styles.rejectedNote}>
            Rider rejected your request
          </Text>
        ) : rider.to_location ? (
          <Text style={styles.toLocation}>Going to {rider.to_location}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          styles.selectButton,
          isPending && styles.selectButtonPending,
          isRejected && styles.selectButtonRejected,
        ]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.86}
        disabled={disabled}
      >
        <Text style={styles.selectButtonText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AvailableRidersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const driverFrom = Array.isArray(params.from) ? params.from[0] : (params.from ?? null);
  const driverTo = Array.isArray(params.to) ? params.to[0] : (params.to ?? null);
  const { send, onMessage, userId, disconnect, getRidersSnapshot } =
    useMatching();
  const [riders, setRiders] = useState([]);
  const [pendingRiderIds, setPendingRiderIds] = useState(new Set());
  const [rejectedRiderIds, setRejectedRiderIds] = useState(new Set());
  const [capacity, setCapacity] = useState(4);
  const [seatsUsed, setSeatsUsed] = useState(0);

  useEffect(() => {
    if (userId) {
      fetch(
        `${SUPABASE_URL}/rest/v1/Car?user_id=eq.${userId}&select=capacity`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        },
      )
        .then((response) => response.json())
        .then((data) => {
          const raw = data?.[0]?.capacity;
          const parsed = typeof raw === "number" ? raw : Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) {
            setCapacity(parsed);
          }
        })
        .catch(() => {});
    }

    setRiders(getRidersSnapshot?.() ?? []);

    const unsubscribe = onMessage((msg) => {
      if (msg.type === "initial_state") {
        setRiders(msg.riders ?? []);
        if (Array.isArray(msg.rejected_by_me)) {
          setRejectedRiderIds(new Set(msg.rejected_by_me));
        }
      }
      if (msg.type === "rider_joined") {
        setRiders((prev) => {
          if (prev.some((rider) => rider.rider_id === msg.rider?.rider_id)) {
            return prev;
          }
          return [...prev, msg.rider];
        });
      }
      if (msg.type === "rider_removed") {
        setRiders((prev) => prev.filter((rider) => rider.rider_id !== msg.rider_id));
        setPendingRiderIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.rider_id);
          return next;
        });
      }
      if (msg.type === "match_rejected" && msg.driver_id === userId) {
        setPendingRiderIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.rider_id);
          return next;
        });
        setRejectedRiderIds((prev) => {
          if (prev.has(msg.rider_id)) return prev;
          const next = new Set(prev);
          next.add(msg.rider_id);
          return next;
        });
      }
      if (msg.type === "seat_update" && msg.driver_id === userId) {
        if (typeof capacity === "number") {
          const nextUsed = Math.max(
            0,
            capacity - (msg.seats_remaining ?? capacity),
          );
          setSeatsUsed(nextUsed);
        }
      }
      if (msg.type === "match_confirmed") {
        setSeatsUsed((prev) => prev + 1);
        setPendingRiderIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.rider?.id);
          return next;
        });
        router.push("/driver/ScheduledRidesDriver");
      }
    });

    return () => unsubscribe?.();
  }, [userId]);

  function handleSelectRider(rider) {
    if (pendingRiderIds.has(rider.rider_id)) return;
    if (rejectedRiderIds.has(rider.rider_id)) return;

    if (capacity !== null && seatsUsed + pendingRiderIds.size >= capacity) {
      Alert.alert("Car Full", "Car seat capacity reached.");
      return;
    }

    send({
      type: "select_rider",
      driver_id: userId,
      rider_id: rider.rider_id,
    });
    setPendingRiderIds((prev) => new Set(prev).add(rider.rider_id));
  }

  const seatsRemaining = Math.max(0, capacity - seatsUsed);
  const pendingCount = pendingRiderIds.size;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            disconnect();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.upcomingButton}
          onPress={() => router.push("/driver/ScheduledRidesDriver")}
          activeOpacity={0.82}
        >
          <Text style={styles.upcomingButtonText}>Upcoming rides</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>Driver queue</Text>
        <Text style={styles.heroTitle}>Select riders for this trip</Text>
        <Text style={styles.heroBody}>
          Choose riders as they appear. Confirmed matches move into your scheduled rides
          automatically.
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Seats filled</Text>
          <Text style={styles.metricValue}>
            {seatsUsed} / {capacity}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending</Text>
          <Text style={styles.metricValue}>{pendingCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Remaining</Text>
          <Text style={styles.metricValue}>{seatsRemaining}</Text>
        </View>
      </View>

      <RouteMap
        pickup={driverFrom}
        dropoff={driverTo}
        extraMarkers={riders
          .filter((r) => r.pickup_loc && r.pickup_loc !== driverFrom)
          .map((r) => ({ label: r.name ?? "Rider", location: r.pickup_loc, color: "#3B82F6" }))}
        height={200}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Waiting riders</Text>
        <Text style={styles.sectionSub}>
          Tap a rider to send them the offer for this seat.
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {riders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No riders waiting yet</Text>
            <Text style={styles.emptyText}>
              Keep this screen open. New rider requests will appear here in real time.
            </Text>
          </View>
        ) : (
          riders.map((rider) => (
            <RiderCard
              key={rider.rider_id}
              rider={rider}
              isPending={pendingRiderIds.has(rider.rider_id)}
              isRejected={rejectedRiderIds.has(rider.rider_id)}
              onPress={() => handleSelectRider(rider)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2efe7",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
  upcomingButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#d8cebe",
  },
  upcomingButtonText: {
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
    maxWidth: "94%",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#e4dacb",
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6f8278",
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20352d",
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20352d",
  },
  sectionSub: {
    fontSize: 14,
    color: "#647970",
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdf8",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e4dacb",
    padding: 16,
    gap: 14,
  },
  cardPending: {
    backgroundColor: "#eef3ef",
    opacity: 0.85,
  },
  cardRejected: {
    backgroundColor: "#f7ecec",
    borderColor: "#e0c4c4",
    opacity: 0.85,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#dfe8e2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1c4d38",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20352d",
  },
  toLocation: {
    fontSize: 13,
    color: "#61746c",
  },
  rejectedNote: {
    fontSize: 13,
    fontWeight: "700",
    color: "#a04141",
  },
  rating: {
    fontSize: 13,
    fontWeight: "700",
    color: "#956526",
  },
  ratingMuted: {
    fontSize: 13,
    color: "#8c9693",
  },
  selectButton: {
    minWidth: 82,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#1c4d38",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  selectButtonPending: {
    backgroundColor: "#81948b",
  },
  selectButtonRejected: {
    backgroundColor: "#b07a7a",
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff9ef",
  },
  emptyState: {
    borderRadius: 24,
    backgroundColor: "#fbf7ef",
    borderWidth: 1,
    borderColor: "#e4dacb",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 8,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#20352d",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#647970",
    textAlign: "center",
  },
});
