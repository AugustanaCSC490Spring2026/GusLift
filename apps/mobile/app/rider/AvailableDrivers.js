import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMatching } from "../../context/MatchingContext";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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
          <Text style={styles.waitingSub}>You will be notified when a driver accepts your ride.</Text>
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
              {matchedDriver.to_location ? (
                <Text style={styles.driverMeta}>To: {matchedDriver.to_location}</Text>
              ) : null}
              {matchedDriver.car && <Text style={styles.driverCar}>{matchedDriver.car}</Text>}
            </View>

            {confirming ? (
              <ActivityIndicator size="small" color="#1a3a6b" />
            ) : (
              <Text style={styles.confirmArrow}>→</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleRejectAndKeepSearching}
            activeOpacity={0.8}
            disabled={confirming}
          >
            <Text style={styles.rejectButtonText}>Reject and keep searching</Text>
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
  driverMeta: {
    fontSize: 13,
    color: "#6b7280",
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
  rejectButton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
});
