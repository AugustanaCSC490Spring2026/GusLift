import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatRideDateLong,
  formatTime12h,
} from "../../lib/rideDisplayTime";
import { safeGoBack } from "../../lib/navigation";
import { normRideId } from "../../lib/ratingUtils";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

function paramStr(v) {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

export default function RideDetailHistory() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [detailFromApi, setDetailFromApi] = useState(null);
  const [detailLoading, setDetailLoading] = useState(
    () => Boolean(paramStr(params.ride_id)),
  );

  useEffect(() => {
    const rideId = paramStr(params.ride_id);
    if (!rideId || !BACKEND_URL) {
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) {
        if (!cancelled) setDetailLoading(false);
        return;
      }
      const uid = JSON.parse(stored).id;
      const normalizedUrl = BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(
        `${normalizedUrl}/api/rides/history?driver_id=${encodeURIComponent(uid)}`,
      );
      if (cancelled) return;
      if (res.ok) {
        const payload = await res.json();
        const found = (payload?.rides ?? []).find(
          (r) => normRideId(r.id) === normRideId(rideId),
        );
        setDetailFromApi(found ?? null);
      } else {
        setDetailFromApi(null);
      }
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.ride_id]);

  const ride = detailFromApi
    ? {
        id: String(detailFromApi.id),
        ride_date: detailFromApi.ride_date,
        day: detailFromApi.day,
        start_time: detailFromApi.start_time,
        pickup_loc:
          detailFromApi.pickup_loc ?? detailFromApi.location ?? null,
        dropoff_loc: detailFromApi.dropoff_loc ?? null,
        rider: {
          id: String(
            detailFromApi.rider?.id ??
              detailFromApi.rider_id ??
              paramStr(params.rider_id),
          ),
          name:
            detailFromApi.rider?.name ?? paramStr(params.rider_name),
          residence:
            detailFromApi.rider?.residence ??
            paramStr(params.rider_residence),
          picture_url:
            detailFromApi.rider?.picture_url ??
            paramStr(params.rider_picture_url),
        },
        car: detailFromApi.car,
      }
    : {
        id: paramStr(params.ride_id),
        ride_date: paramStr(params.ride_date),
        day: paramStr(params.day),
        start_time: paramStr(params.start_time),
        pickup_loc: paramStr(params.pickup_loc),
        dropoff_loc: paramStr(params.dropoff_loc),
        rider: {
          id: paramStr(params.rider_id),
          name: paramStr(params.rider_name),
          residence: paramStr(params.rider_residence),
          picture_url: paramStr(params.rider_picture_url),
        },
        car: paramStr(params.car_make)
          ? {
              make: paramStr(params.car_make),
              model: paramStr(params.car_model),
              color: paramStr(params.car_color),
              license_plate: paramStr(params.car_license_plate),
            }
          : null,
      };

  const getInitial = (name) => {
    const trimmed = String(name || "").trim();
    return trimmed ? trimmed[0].toUpperCase() : "R";
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => safeGoBack(router, "/driver/RideHistoryDriver")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Ride Details</Text>

        {detailLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1c4d38" />
            <Text style={styles.loadingText}>Loading ride…</Text>
          </View>
        ) : null}

        <View style={styles.dateCard}>
          <Ionicons name="calendar-outline" size={20} color="#1c4d38" />
          <Text style={styles.dateText}>
            {formatRideDateLong(ride.ride_date) || ride.day || "—"}
          </Text>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>
                {ride.pickup_loc || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotEnd]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeValue}>
                {ride.dropoff_loc || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.timeText}>
              Pickup at {formatTime12h(ride.start_time)}
            </Text>
          </View>
        </View>

        <View style={styles.personCard}>
          <Text style={styles.sectionLabel}>Rider</Text>
          <View style={styles.personRow}>
            <View style={styles.avatarWrap}>
              {ride.rider.picture_url ? (
                <Image
                  source={{ uri: ride.rider.picture_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitial(ride.rider.name)}
                </Text>
              )}
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>
                {ride.rider.name || "Unknown rider"}
              </Text>
              {ride.rider.residence ? (
                <Text style={styles.personSub}>{ride.rider.residence}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {ride.car ? (
          <View style={styles.carCard}>
            <Text style={styles.sectionLabel}>Your Vehicle</Text>
            <View style={styles.carDetailsRow}>
              <View style={styles.carIconWrap}>
                <Ionicons name="car-sport" size={24} color="#1c4d38" />
              </View>
              <View style={styles.carInfo}>
                <Text style={styles.carTitle}>
                  {[ride.car.color, ride.car.make, ride.car.model]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </Text>
                {ride.car.license_plate ? (
                  <View style={styles.plateBadge}>
                    <Text style={styles.plateText}>
                      {ride.car.license_plate}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text style={styles.statusText}>Completed</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f6f1",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#dce7e0",
    borderRadius: 14,
    padding: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1c4d38",
  },
  routeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 0,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1c4d38",
  },
  routeDotEnd: {
    backgroundColor: "#16a34a",
  },
  routeInfo: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  routeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#d1d5db",
    marginLeft: 5,
    marginVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  personCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#dce7e0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1c4d38",
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1f2937",
  },
  personSub: {
    fontSize: 13,
    color: "#6b7280",
  },
  carCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  carDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  carIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  carInfo: {
    flex: 1,
    gap: 6,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  plateBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 1,
  },
  statusRow: {
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16a34a",
  },
});
