import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import RouteMap from "../../components/RouteMap";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMatching } from "../../context/MatchingContext";
import { fetchUserRatingSummary } from "../../lib/ratingUtils";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

function getInitial(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "D";
}

export default function AvailableDrivers() {
  const router = useRouter();
  const {
    driverId: initialDriverId,
    driverName: initialDriverName,
    driverPic: initialDriverPic,
    driverTo: initialDriverTo,
    driverCar: initialDriverCar,
    driverRating: initialDriverRating,
    from,
    to,
  } = useLocalSearchParams();
  const { send, onMessage, userId, disconnect } = useMatching();
  const [matchedDriver, setMatchedDriver] = useState(null);
  const [driverRatingCount, setDriverRatingCount] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const driverDirectoryRef = useRef(new Map());

  function parseRatingParam(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

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
      pickup_loc: rawDriver.pickup_loc ?? null,
      to_location: rawDriver.to_location ?? null,
      car: carParts.length ? carParts.join(" · ") : null,
      rating:
        rawDriver.rating != null && Number.isFinite(Number(rawDriver.rating))
          ? Number(rawDriver.rating)
          : null,
    });
  }

  useEffect(() => {
    const unsubscribe = onMessage(async (msg) => {
      if (msg.type === "initial_state" && Array.isArray(msg.drivers)) {
        msg.drivers.forEach((driver) => {
          upsertDriverDirectory(driver.driver_id, driver);
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
            pickup_loc: sourceDriver.pickup_loc ?? null,
            to_location: sourceDriver.to_location ?? null,
            car: carParts.length ? carParts.join(" · ") : null,
            rating:
              sourceDriver.rating != null &&
              Number.isFinite(Number(sourceDriver.rating))
                ? Number(sourceDriver.rating)
                : null,
          };
        }
        const wsRating =
          driver.rating != null && Number.isFinite(Number(driver.rating))
            ? Number(driver.rating)
            : null;
        setMatchedDriver({ ...driver, driver_id: msg.driver_id, rating: wsRating });
        setDriverRatingCount(null);
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
    if (!initialDriverId) return;
    setMatchedDriver({
      name: initialDriverName ? String(initialDriverName) : null,
      picture_url: initialDriverPic ? String(initialDriverPic) : null,
      to_location: initialDriverTo ? String(initialDriverTo) : null,
      car: initialDriverCar ? String(initialDriverCar) : null,
      driver_id: initialDriverId,
      rating: parseRatingParam(initialDriverRating),
    });
    setDriverRatingCount(null);
  }, [
    initialDriverId,
    initialDriverName,
    initialDriverPic,
    initialDriverTo,
    initialDriverCar,
    initialDriverRating,
  ]);

  useEffect(() => {
    const driverId = matchedDriver?.driver_id;
    if (!driverId || !BACKEND_URL) {
      setDriverRatingCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { average, count } = await fetchUserRatingSummary(
        driverId,
        BACKEND_URL,
      );
      if (cancelled) return;
      setDriverRatingCount(count);
      setMatchedDriver((prev) => {
        if (!prev || String(prev.driver_id) !== String(driverId)) return prev;
        return {
          ...prev,
          rating: average ?? prev.rating ?? null,
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [matchedDriver?.driver_id]);

  async function waitForAcceptedRide(driverId) {
    if (!driverId || !userId) return null;
    if (!BACKEND_URL) return null;
    const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
    const endpoint =
      `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(
        String(userId),
      )}` +
      `&driver_id=${encodeURIComponent(String(driverId))}&limit=1`;

    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const payload = await res.json();
          const rows = payload?.rides ?? [];
          if (Array.isArray(rows) && rows[0]?.id) return rows[0].id;
        }
      } catch (_) {
        // Keep polling briefly while the backend writes the accepted ride.
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    return null;
  }

  async function handleConfirm() {
    if (!matchedDriver) return;
    setConfirming(true);
    const riderTo = to
      ? String(Array.isArray(to) ? to[0] : to).trim()
      : "";
    send({
      type: "accept_match",
      rider_id: userId,
      driver_id: matchedDriver.driver_id,
      ...(riderTo ? { rider_to_location: riderTo } : {}),
    });
    const rideId = await waitForAcceptedRide(matchedDriver.driver_id);
    setConfirming(false);
    router.replace({
      pathname: "/rider/ScheduledRidesRider",
      params: rideId ? { rideId } : undefined,
    });
  }

  function handleRejectAndKeepSearching() {
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
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          activeOpacity={0.82}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ridesButton}
          onPress={() => router.push("/rider/ScheduledRidesRider")}
          activeOpacity={0.82}
        >
          <Text style={styles.ridesButtonText}>My rides</Text>
        </TouchableOpacity>
      </View>

      {!matchedDriver ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>Match search</Text>
            <Text style={styles.heroTitle}>Looking for a driver</Text>
            <Text style={styles.heroBody}>
              Stay here while matching runs. As soon as a driver accepts, you can review the
              details and confirm the ride.
            </Text>
          </View>

          <View style={styles.tripCard}>
            <Text style={styles.tripTitle}>Current request</Text>
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>From</Text>
              <Text style={styles.tripValue}>{from || "—"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>To</Text>
              <Text style={styles.tripValue}>{to || "—"}</Text>
            </View>
          </View>

          <RouteMap pickup={from} dropoff={to} height={200} />

          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.waitingTitle}>Matching is active</Text>
            <Text style={styles.waitingBody}>
              We will move you forward as soon as a driver becomes available for this route.
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.heroCardMatched}>
            <View style={styles.heroGlowMatched} />
            <Text style={styles.heroEyebrow}>Driver found</Text>
            <Text style={styles.heroTitle}>Review your match</Text>
            <Text style={styles.heroBody}>
              Confirm this driver to lock in the ride, or reject and keep searching for another
              option.
            </Text>
          </View>

          <View style={styles.driverCard}>
            {matchedDriver.picture_url ? (
              <Image source={{ uri: matchedDriver.picture_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {getInitial(matchedDriver.name)}
                </Text>
              </View>
            )}

            <View style={styles.driverMeta}>
              <Text style={styles.driverName}>
                {matchedDriver.name ?? "Unknown driver"}
              </Text>
              <Text style={styles.driverLabel}>Assigned driver</Text>
              {matchedDriver.rating != null ? (
                <Text style={styles.driverAvgRating}>
                  ★ {matchedDriver.rating.toFixed(1)} average
                  {driverRatingCount != null && driverRatingCount > 0
                    ? ` (${driverRatingCount})`
                    : ""}
                </Text>
              ) : driverRatingCount === 0 ? (
                <Text style={styles.driverAvgRatingMuted}>No ratings yet</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.matchInfoCard}>
            {matchedDriver.to_location ? (
              <>
                <View style={styles.tripRow}>
                  <Text style={styles.tripLabel}>Driver route</Text>
                  <Text style={styles.tripValue}>{matchedDriver.to_location}</Text>
                </View>
                <View style={styles.divider} />
              </>
            ) : null}
            <View style={styles.tripRow}>
              <Text style={styles.tripLabel}>Vehicle</Text>
              <Text style={styles.tripValue}>
                {matchedDriver.car || "Vehicle details unavailable"}
              </Text>
            </View>
          </View>

          <RouteMap
            pickup={from}
            dropoff={to}
            extraMarkers={
              matchedDriver?.pickup_loc
                ? [{ label: "Driver pickup", location: matchedDriver.pickup_loc, color: "#8B5CF6" }]
                : []
            }
            height={220}
          />

          <TouchableOpacity
            style={[styles.primaryButton, confirming && styles.primaryButtonDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.86}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff9ef" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm this driver</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRejectAndKeepSearching}
            activeOpacity={0.86}
            disabled={confirming}
          >
            <Text style={styles.secondaryButtonText}>Reject and keep searching</Text>
          </TouchableOpacity>
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
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
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
  ridesButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  ridesButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  heroCard: {
    backgroundColor: "#0F172A",
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
    backgroundColor: "#3B82F6",
    top: -58,
    right: -28,
    opacity: 0.4,
  },
  heroCardMatched: {
    backgroundColor: "#0F172A",
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    gap: 10,
  },
  heroGlowMatched: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#3B82F6",
    top: -58,
    right: -28,
    opacity: 0.55,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.7)",
  },
  heroTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.7,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.8)",
    maxWidth: "94%",
  },
  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  tripLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#64748B",
  },
  tripValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  waitingCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  waitingBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3B82F6",
  },
  driverMeta: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  driverLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  driverAvgRating: {
    fontSize: 15,
    fontWeight: "800",
    color: "#b45309",
    marginTop: 2,
  },
  driverAvgRatingMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 2,
  },
  matchInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(59,130,246,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3B82F6",
  },
});
