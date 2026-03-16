import { useMatching } from "../../context/MatchingContext";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export default function AvailableDrivers() {
  const router = useRouter();
  const { send, onMessage, userId, disconnect } = useMatching();
  const [matchedDriver, setMatchedDriver] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const unsubscribe = onMessage(async (msg) => {
      if (msg.type === "match_request") {
        const driver = await fetchDriverInfo(msg.driver_id);
        setMatchedDriver({ ...driver, driver_id: msg.driver_id });
        setConfirming(false);
      }
      if (msg.type === "rider_joined" && msg.rider?.rider_id === userId) {
        setMatchedDriver(null);
        setConfirming(false);
      }
      if (msg.type === "match_confirmed") {
        router.replace({
          pathname: "/rider/RiderMatchedScreen",
          params: { rideId: msg.ride?.id ?? "" },
        });
      }
    });
    return () => unsubscribe?.();
  }, [userId]);

  async function fetchDriverInfo(driverId) {
    try {
      const [userRes, carRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/User?id=eq.${driverId}&select=name,picture_url`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/Car?user_id=eq.${driverId}&select=make,model,color`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        ),
      ]);
      const users = await userRes.json();
      const cars = await carRes.json();
      return {
        name: users?.[0]?.name ?? null,
        picture_url: users?.[0]?.picture_url ?? null,
        car: cars?.[0] ? `${cars[0].color ?? ""} ${cars[0].make ?? ""} ${cars[0].model ?? ""}`.trim() : null,
      };
    } catch (_) {
      return { name: null, picture_url: null, car: null };
    }
  }

  function handleConfirm() {
    if (!matchedDriver) return;
    setConfirming(true);
    send({ type: "accept_match", rider_id: userId, driver_id: matchedDriver.driver_id });
  }

  function handleCancel() {
    disconnect();
    router.replace("/home");
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ridesButton}
        onPress={() => router.push("/rider/ScheduledRidesRider")}
        activeOpacity={0.8}
      >
        <Text style={styles.ridesButtonText}>Rides</Text>
      </TouchableOpacity>

      {!matchedDriver ? (
        // Waiting state
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#1a3a6b" style={{ marginBottom: 16 }} />
          <Text style={styles.waitingTitle}>Looking for a driver...</Text>
          <Text style={styles.waitingSub}>You'll be notified when a driver accepts your ride.</Text>
        </View>
      ) : (
        // Driver accepted — show confirm card
        <View style={styles.matchContainer}>
          <Text style={styles.matchTitle}>Driver accepted the ride</Text>
          <Text style={styles.matchSub}>Tap below to confirm</Text>

          <TouchableOpacity
            style={[styles.driverCard, confirming && styles.driverCardDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={confirming}
          >
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
              {matchedDriver.car && <Text style={styles.driverCar}>{matchedDriver.car}</Text>}
            </View>

            {confirming ? (
              <ActivityIndicator size="small" color="#1a3a6b" />
            ) : (
              <Text style={styles.confirmArrow}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  ridesButton: {
    position: "absolute",
    top: 56,
    right: 24,
    backgroundColor: "#1a3a6b",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  ridesButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  waitingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  waitingSub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  matchContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  matchTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  matchSub: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: "#1a3a6b",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    gap: 14,
  },
  driverCardDisabled: {
    opacity: 0.6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a3a6b",
  },
  driverInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
  },
  driverCar: {
    fontSize: 13,
    color: "#6b7280",
  },
  confirmArrow: {
    fontSize: 20,
    color: "#1a3a6b",
    fontWeight: "700",
  },
});
