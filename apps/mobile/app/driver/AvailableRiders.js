import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useMatching } from "../../context/MatchingContext";

import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function RiderCard({ rider, isPending, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.card, isPending && styles.cardPending]}
      onPress={onPress}
      activeOpacity={isPending ? 1 : 0.7}
      disabled={isPending}
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
        <Text style={styles.name}>{rider.name ?? "Unknown Rider"}</Text>
        {rider.to_location ? (
          <Text style={styles.toLocation}>To: {rider.to_location}</Text>
        ) : null}
        {rider.rating != null && (
          <Text style={styles.rating}>★ {rider.rating.toFixed(1)}</Text>
        )}
      </View>

      {isPending && <Text style={styles.pendingBadge}>Waiting...</Text>}
    </TouchableOpacity>
  );
}

export default function AvailableRidersScreen() {
  const router = useRouter();
  const { send, onMessage, userId, disconnect, getRidersSnapshot } = useMatching();
  const [riders, setRiders] = useState([]);
  const [pendingRiderIds, setPendingRiderIds] = useState(new Set());
  const [capacity, setCapacity] = useState(4);
  const [seatsUsed, setSeatsUsed] = useState(0);

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

    // Seed from snapshot: initial_state may have fired on the previous screen before we mounted.
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

  return (
    <View style={styles.container}>
      {/* Header row */}
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
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.upcomingButton}
          onPress={() => router.push("/driver/ScheduledRidesDriver")}
          activeOpacity={0.8}
        >
          <Text style={styles.upcomingButtonText}>Upcoming Rides</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.header}>Upcoming Riders</Text>

      {capacity !== null && (
        <Text style={styles.seatsText}>
          {seatsUsed} / {capacity} seats filled
        </Text>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {riders.length === 0 ? (
          <Text style={styles.emptyText}>No riders waiting yet...</Text>
        ) : (
          riders.map((rider) => (
            <RiderCard
              key={rider.rider_id}
              rider={rider}
              isPending={pendingRiderIds.has(rider.rider_id)}
              onPress={() => handleSelectRider(rider)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    padding: 24,
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  upcomingButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  upcomingButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  seatsText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
  },
  cardPending: {
    opacity: 0.6,
    backgroundColor: "#f0f4ff",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a3a6b",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  toLocation: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 2,
  },
  rating: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "600",
  },
  pendingBadge: {
    fontSize: 13,
    color: "#1a3a6b",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 40,
  },
});
