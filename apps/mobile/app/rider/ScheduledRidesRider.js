import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { calculateFare } from "../../lib/fareCalc";
import { ClockIcon, HistoryLineIcon } from "../../components/Icons";
import RatingPill from "../../components/RatingPill";
import { useRiderCompletionFlow } from "../../context/RiderCompletionFlowContext";
import { useMatching } from "../../context/MatchingContext";
import {
  buildRiderRideDetailHistoryParams,
  hasStarScore,
} from "../../lib/ratingUtils";
import {
  handleRiderCompletionDetected,
  pollRiderUpcomingCompletions,
} from "../../lib/riderCompletionPrompt";
import {
  deriveRideDisplayTimes,
  getScheduleClassStart,
} from "../../lib/rideTimeDisplay";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const RIDES_POLL_MS = 5000;

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
  const isCompleted = status === 'Completed';

  const bgColor = isCompleted ? COLORS.gray100 : '#EFF6FF';
  const textColor = isCompleted ? COLORS.gray400 : COLORS.blue;

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

function mapHistoryApiRideToCard(ride, scheduleDays) {
  const scheduleClassStart = getScheduleClassStart(scheduleDays, ride.ride_date);
  const { pickupTime, classTime } = deriveRideDisplayTimes(
    ride.start_time,
    scheduleClassStart,
  );
  const car = ride.car;
  return {
    id: ride.id,
    timestamp: ride.ride_date,
    pickupTime,
    classTime,
    pickup: ride.pickup_loc ?? ride.location ?? "—",
    destination: ride.dropoff_loc ?? "—",
    driver: ride.driver
      ? {
          name: ride.driver.name,
          image: ride.driver.picture_url || null,
          car: car
            ? [car.color, car.make, car.model].filter(Boolean).join(" ")
            : null,
          plate: car?.license_plate ?? null,
        }
      : null,
    status: "Completed",
    my_rating: ride.my_rating ?? null,
    historyRow: ride,
  };
}

const RideCard = ({ ride, onPress, isFirstOfUpcoming, showRating }) => {
  const isCompleted = ride.status === "Completed";

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
        <View style={styles.cardTopRight}>
          {showRating && isCompleted ? (
            hasStarScore(ride.my_rating) ? (
              <RatingPill score={ride.my_rating} variant="compact" />
            ) : (
              <RatingPill variant="cta" ctaLabel="Rate driver" />
            )
          ) : null}
          <StatusBadge status={ride.status} />
        </View>
      </View>

      <View style={styles.infoRow}>
        <InfoBox label="Pick up time" value={ride.pickupTime} accent />
        <View style={{ width: 10 }} />
        <InfoBox label="Class start time" value={ride.classTime} />
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
        {ride.status === 'Completed' && (
          <View style={[styles.paymentPill, ride.paymentStatus === 'verified' ? styles.paymentPillPaid : styles.paymentPillPending]}>
            <Text style={[styles.paymentPillText, ride.paymentStatus === 'verified' ? styles.paymentPillTextPaid : styles.paymentPillTextPending]}>
              {ride.paymentStatus === 'verified' ? 'Paid' : 'Payment pending'}
            </Text>
          </View>
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

const RideDetail = ({ ride, onBack }) => {
  const isCompleted = ride.status === 'Completed';
  const [userId, setUserId] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [code, setCode] = useState(null);

  const fareResult = calculateFare(ride.pickup, ride.destination);
  const normalizedBackend = BACKEND_URL?.replace(/\/$/, "") ?? "";

  useEffect(() => {
    AsyncStorage.getItem("@user").then((stored) => {
      if (stored) setUserId(JSON.parse(stored).id);
    });
    if (ride.id && BACKEND_URL) {
      fetch(`${normalizedBackend}/api/rides/${ride.id}/payment`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setPaymentInfo(data); })
        .catch(() => {})
        .finally(() => setPaymentLoading(false));
    } else {
      setPaymentLoading(false);
    }
  }, [ride.id]);

  async function generateCode(method) {
    if (!userId || !BACKEND_URL) return;
    setGeneratingCode(true);
    try {
      const res = await fetch(`${normalizedBackend}/api/rides/${ride.id}/payment/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          payment_method: method,
          fare_cents: fareResult?.fareCents ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setCode(data.code);
        setPaymentInfo((prev) => ({ ...prev, payment_status: "code_issued" }));
      } else {
        Alert.alert("Error", data.error ?? "Could not generate code.");
      }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setGeneratingCode(false);
    }
  }

  const paymentStatus = paymentInfo?.payment_status ?? "pending";
  const driverPayment = paymentInfo?.driver_payment;

  const hasVenmo = Boolean(driverPayment?.venmo_username);
  const hasCashApp = Boolean(driverPayment?.cashapp_username);
  const hasZelle = Boolean(driverPayment?.zelle_contact);
  const hasCash = driverPayment?.accepts_cash !== false;
  const hasStripe = Boolean(driverPayment?.stripe_onboarded);
  const noPaymentMethods = !hasVenmo && !hasCashApp && !hasZelle && !hasCash && !hasStripe;

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
            <InfoBox label="Class start time" value={ride.classTime} />
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

        {/* Payment section — only for accepted (upcoming) rides */}
        {!isCompleted && (
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Payment</Text>

            {fareResult && (
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Suggested fare</Text>
                <Text style={styles.fareAmount}>{fareResult.fareLabel}</Text>
              </View>
            )}

            {paymentLoading ? (
              <ActivityIndicator color={COLORS.blue} style={{ marginTop: 12 }} />
            ) : paymentStatus === "verified" ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Payment verified by driver</Text>
              </View>
            ) : (code || paymentStatus === "code_issued") ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Tell your driver this code</Text>
                <Text style={styles.codeValue}>{code ?? "····"}</Text>
                <Text style={styles.codeHint}>
                  Say it out loud when you get in the car. Your driver will enter it to confirm.
                </Text>
                {!code && (
                  <TouchableOpacity
                    style={styles.reshowButton}
                    onPress={() => generateCode(paymentInfo?.payment_method ?? "cash")}
                    disabled={generatingCode}
                  >
                    <Text style={styles.reshowButtonText}>Re-show code</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : noPaymentMethods ? (
              <Text style={styles.paymentNote}>
                Your driver has not set up digital payments. Pay in cash when you get in.
              </Text>
            ) : (
              <View style={styles.methodList}>
                <Text style={styles.methodListLabel}>Choose how you will pay</Text>

                {hasStripe && (
                  <TouchableOpacity
                    style={[styles.methodButton, { backgroundColor: "#635BFF" }]}
                    onPress={() => generateCode("stripe")}
                    disabled={generatingCode}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.methodButtonText}>Pay with card (Stripe)</Text>
                  </TouchableOpacity>
                )}

                {hasVenmo && (
                  <View style={styles.manualMethodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualMethodName}>Venmo</Text>
                      <Text style={styles.manualMethodHandle}>{driverPayment.venmo_username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iVePaidButton}
                      onPress={() => generateCode("venmo")}
                      disabled={generatingCode}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iVePaidButtonText}>I&apos;ve paid</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {hasCashApp && (
                  <View style={styles.manualMethodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualMethodName}>Cash App</Text>
                      <Text style={styles.manualMethodHandle}>{driverPayment.cashapp_username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iVePaidButton}
                      onPress={() => generateCode("cashapp")}
                      disabled={generatingCode}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iVePaidButtonText}>I&apos;ve paid</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {hasZelle && (
                  <View style={styles.manualMethodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualMethodName}>Zelle</Text>
                      <Text style={styles.manualMethodHandle}>{driverPayment.zelle_contact}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iVePaidButton}
                      onPress={() => generateCode("zelle")}
                      disabled={generatingCode}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iVePaidButtonText}>I&apos;ve paid</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {hasCash && (
                  <TouchableOpacity
                    style={styles.cashButton}
                    onPress={() => generateCode("cash")}
                    disabled={generatingCode}
                    activeOpacity={0.85}
                  >
                    {generatingCode ? (
                      <ActivityIndicator color={COLORS.dark} size="small" />
                    ) : (
                      <Text style={styles.cashButtonText}>I&apos;ll pay in cash</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
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
  const { pendingMatch } = useMatching();
  const { startCompletionFlow } = useRiderCompletionFlow();
  const [activeTab, setActiveTab] = useState(params.tab || 'upcoming');
  const [selectedRide, setSelectedRide] = useState(null);

  const [loading, setLoading] = useState(true);
  const [upcomingRides, setUpcomingRides] = useState([]);
  const [historyRides, setHistoryRides] = useState([]);
  const refreshRidesRef = useRef(() => Promise.resolve());

  async function pollUpcomingForCompletion() {
    if (!BACKEND_URL) return;
    const stored = await AsyncStorage.getItem("@user");
    if (!stored) return;
    const user = JSON.parse(stored);

    const { currentRides, justCompleted } = await pollRiderUpcomingCompletions(
      user.id,
      BACKEND_URL,
    );

    if (justCompleted) {
      await handleRiderCompletionDetected({
        justCompleted,
        riderUserId: user.id,
        startCompletionFlow,
      });
    }

    await loadRides("upcoming", currentRides);
  }

  async function refreshAllRides() {
    await pollUpcomingForCompletion();
    await loadRides("history");
  }

  refreshRidesRef.current = refreshAllRides;

  useFocusEffect(
    useCallback(() => {
      if (params.fromCompletion) {
        setSelectedRide(null);
        setActiveTab("upcoming");
        void refreshRidesRef.current();
      }
    }, [params.fromCompletion]),
  );

  useEffect(() => {
    void refreshAllRides();
    const pollId = setInterval(() => {
      void refreshRidesRef.current();
    }, RIDES_POLL_MS);
    return () => clearInterval(pollId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshRidesRef.current();
    }, []),
  );

  async function loadRides(type, upcomingFromPoll = null) {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const user = JSON.parse(stored);
      if (!BACKEND_URL) return;

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const isHistory = type === "history";

      const scheduleRes = await fetch(
        `${normalizedBackendUrl}/api/rider/schedule`,
        { headers: { "x-user-id": String(user.id) } },
      );
      let scheduleDays = null;
      if (scheduleRes.ok) {
        const scheduleBody = await scheduleRes.json();
        scheduleDays = scheduleBody?.days ?? null;
      }

      if (isHistory) {
        const historyRes = await fetch(
          `${normalizedBackendUrl}/api/rides/history?rider_id=${encodeURIComponent(String(user.id))}`,
        );
        if (!historyRes.ok) return;
        const historyPayload = await historyRes.json();
        const historyRows = historyPayload?.rides ?? [];
        setHistoryRides(
          historyRows.map((ride) => mapHistoryApiRideToCard(ride, scheduleDays)),
        );
        return;
      }

      const ridesData =
        upcomingFromPoll != null
          ? upcomingFromPoll
          : await (async () => {
              const url = `${normalizedBackendUrl}/api/driver/rides?rider_id=${encodeURIComponent(String(user.id))}`;
              const res = await fetch(url);
              if (!res.ok) return null;
              const payload = await res.json();
              return payload?.rides ?? [];
            })();

      if (ridesData == null) return;

      const enriched = ridesData.map((ride) => {
        const scheduleClassStart = getScheduleClassStart(
          scheduleDays,
          ride.ride_date,
        );
        const { pickupTime, classTime } = deriveRideDisplayTimes(
          ride.start_time,
          scheduleClassStart,
        );

        return {
          id: ride.id,
          timestamp: ride.ride_date,
          pickupTime,
          classTime,
          pickup: ride.pickup_loc,
          destination: ride.dropoff_loc,
          driver: ride.driver ? {
            name: ride.driver.name,
            image: ride.driver.picture_url || null,
            car: `${ride.car.color} ${ride.car.make} ${ride.car.model}`,
            plate: ride.car.license_plate,
          } : null,
          status: ride.status === 'completed' ? 'Completed' : 'Accepted',
          paymentStatus: ride.payment_status ?? 'pending',
          fareCents: ride.fare_cents ?? null,
        };
      });

      setUpcomingRides(enriched);
    } catch (_) {
      //setError("Failed to load rides. Please try again.");
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

  const currentRides = activeTab === "upcoming" ? upcomingRides : historyRides;
  const isHistoryTab = activeTab === "history";

  function openRide(ride) {
    if (isHistoryTab && ride.historyRow) {
      const params = buildRiderRideDetailHistoryParams(ride.historyRow);
      if (params) {
        router.push({ pathname: "/rider/RideDetailHistory", params });
      }
      return;
    }
    setSelectedRide(ride);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Rides</Text>
          <TouchableOpacity onPress={() => router.replace("/rider/RiderHome")} style={styles.getRideButton} activeOpacity={0.85}>
            <Text style={styles.getRideButtonText}>Get a Ride  +</Text>
          </TouchableOpacity>
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
        {pendingMatch && (
          <TouchableOpacity
            style={styles.pendingBanner}
            activeOpacity={0.88}
            onPress={() => {
              const carParts = pendingMatch.driver?.car
                ? [
                    [pendingMatch.driver.car.color, pendingMatch.driver.car.make, pendingMatch.driver.car.model]
                      .filter(Boolean).join(" ").trim(),
                    pendingMatch.driver.car.license_plate,
                  ].filter(Boolean)
                : [];
              router.push({
                pathname: "/rider/AvailableDrivers",
                params: {
                  driverId: pendingMatch.driver_id,
                  driverName: pendingMatch.driver?.name ?? "",
                  driverPic: pendingMatch.driver?.picture_url ?? "",
                  driverTo: pendingMatch.driver?.to_location ?? "",
                  driverCar: carParts.join(" · "),
                },
              });
            }}
          >
            <Text style={styles.pendingBannerIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingBannerTitle}>Driver found!</Text>
              <Text style={styles.pendingBannerSub}>Tap to confirm your ride</Text>
            </View>
            <Text style={styles.pendingBannerChevron}>›</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'upcoming' && currentRides.length > 0 ? (
          <View>
            <View style={styles.nextRideBanner}>
              <View>
                <Text style={styles.nextRideBannerLabel}>NEXT RIDE</Text>
                <Text style={styles.nextRideBannerDate}>
                  {formatRideDate(currentRides[0].timestamp)}
                </Text>
              </View>
              <Text style={styles.nextRideBannerTime}>
                Pick up: {currentRides[0].pickupTime}
              </Text>
            </View>

            <RideCard
              ride={currentRides[0]}
              onPress={() => openRide(currentRides[0])}
              isFirstOfUpcoming
              showRating={isHistoryTab}
            />

            <View style={{ marginTop: 16 }}>
              {currentRides.slice(1).map((ride) => (
                <View key={ride.id} style={{ marginBottom: 12 }}>
                  <RideCard
                    ride={ride}
                    onPress={() => openRide(ride)}
                    showRating={isHistoryTab}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            {currentRides.length > 0 ? (
              currentRides.map((ride) => (
                <View key={ride.id} style={{ marginBottom: 12 }}>
                  <RideCard
                    ride={ride}
                    onPress={() => openRide(ride)}
                    showRating={isHistoryTab}
                  />
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingBottom: 20,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 16, alignItems: 'center', marginBottom: 20, paddingRight: 48 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.dark, letterSpacing: -0.5 },
  getRideButton: { backgroundColor: COLORS.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  getRideButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: COLORS.blue },
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
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  paymentPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  paymentPillPaid: { backgroundColor: '#DCFCE7' },
  paymentPillPending: { backgroundColor: '#FEF3C7' },
  paymentPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  paymentPillTextPaid: { color: '#16A34A' },
  paymentPillTextPending: { color: '#D97706' },
  pendingBanner: { backgroundColor: COLORS.dark, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pendingBannerIcon: { fontSize: 20 },
  pendingBannerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white, letterSpacing: -0.3 },
  pendingBannerSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  pendingBannerChevron: { fontSize: 26, color: 'rgba(255,255,255,0.4)', lineHeight: 28 },
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
  paymentCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.gray200, gap: 14 },
  paymentTitle: { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { fontSize: 14, color: COLORS.gray400 },
  fareAmount: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  verifiedBadge: { backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  verifiedBadgeText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  codeBox: { backgroundColor: COLORS.dark, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  codeValue: { fontSize: 48, fontWeight: '900', color: COLORS.white, letterSpacing: 8 },
  codeHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 },
  reshowButton: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  reshowButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  paymentNote: { fontSize: 14, color: COLORS.gray400, lineHeight: 20 },
  methodList: { gap: 10 },
  methodListLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.gray400 },
  methodButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  methodButtonText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  manualMethodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.gray200, gap: 12 },
  manualMethodName: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  manualMethodHandle: { fontSize: 14, color: COLORS.blue, fontWeight: '600', marginTop: 2 },
  iVePaidButton: { backgroundColor: COLORS.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  iVePaidButtonText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  cashButton: { backgroundColor: COLORS.gray100, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray200 },
  cashButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
});
