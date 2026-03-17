import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [driverSetupComplete, setDriverSetupComplete] = useState(false);
  const [riderSetupComplete, setRiderSetupComplete] = useState(false);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (!stored) return;
        const parsed = JSON.parse(stored);
        setRole(parsed?.role ?? null);
        setDriverSetupComplete(Boolean(parsed?.driverSetupComplete));
        setRiderSetupComplete(Boolean(parsed?.riderSetupComplete));
        setUserName(parsed?.given_name ?? parsed?.name?.split(" ")[0] ?? null);
      } catch {
        // ignore
      }
    }
    loadUser();
  }, []);

  const isDriver = role === "driver";
  const isRider = role === "rider";

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}{userName ? `, ${userName}` : ""}
            </Text>
            <Text style={styles.subGreeting}>Where are you headed today?</Text>
          </View>
          <View style={styles.logoMini}>
            <Ionicons name="car-sport" size={20} color="#ffffff" />
          </View>
        </View>

        {role && (
          <View style={styles.roleBadge}>
            <Ionicons
              name={isDriver ? "car-sport-outline" : "walk-outline"}
              size={13}
              color="#1a3a6b"
            />
            <Text style={styles.roleBadgeText}>
              {isDriver ? "Driver" : "Rider"}
            </Text>
          </View>
        )}
      </View>

      {/* Driver actions */}
      {isDriver && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your actions</Text>
          <View style={styles.cards}>
            <TouchableOpacity
              style={styles.primaryCard}
              onPress={() => router.push("/driver/OfferRide")}
              activeOpacity={0.85}
            >
              <View style={styles.primaryCardIcon}>
                <Ionicons name="navigate" size={26} color="#ffffff" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>Offer a Ride</Text>
                <Text style={styles.primaryCardSub}>
                  Go online and match with riders heading to campus
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCard}
              onPress={() => router.push("/driver/DriverSetup")}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryCardIcon}>
                <Ionicons
                  name={driverSetupComplete ? "checkmark-circle" : "settings-outline"}
                  size={24}
                  color={driverSetupComplete ? "#22c55e" : "#1a3a6b"}
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.secondaryCardTitle}>
                  {driverSetupComplete ? "Update Driver Profile" : "Complete Driver Setup"}
                </Text>
                <Text style={styles.secondaryCardSub}>
                  {driverSetupComplete
                    ? "Edit your vehicle info or schedule"
                    : "Add your car details and availability"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCard}
              onPress={() => router.push("/driver/ScheduledRidesDriver")}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryCardIcon}>
                <Ionicons name="calendar-outline" size={24} color="#1a3a6b" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.secondaryCardTitle}>Upcoming Rides</Text>
                <Text style={styles.secondaryCardSub}>
                  View your confirmed rides for the week
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rider actions */}
      {isRider && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your actions</Text>
          <View style={styles.cards}>
            {!riderSetupComplete && (
              <TouchableOpacity
                style={styles.setupPromptCard}
                onPress={() => router.push("/rider/RiderSetup")}
                activeOpacity={0.85}
              >
                <View style={styles.setupPromptIcon}>
                  <Ionicons name="alert-circle" size={22} color="#d97706" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.setupPromptTitle}>Complete Rider Setup</Text>
                  <Text style={styles.setupPromptSub}>
                    Add your pickup location and schedule to start getting rides
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#d97706" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.primaryCard}
              onPress={() => router.push("/rider/RequestRide")}
              activeOpacity={0.85}
            >
              <View style={styles.primaryCardIcon}>
                <Ionicons name="location" size={26} color="#ffffff" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>Request a Ride</Text>
                <Text style={styles.primaryCardSub}>
                  Find a driver heading to campus right now
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCard}
              onPress={() => router.push("/rider/RiderSetup")}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryCardIcon}>
                <Ionicons
                  name={riderSetupComplete ? "checkmark-circle" : "settings-outline"}
                  size={24}
                  color={riderSetupComplete ? "#22c55e" : "#1a3a6b"}
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.secondaryCardTitle}>
                  {riderSetupComplete ? "Update Rider Profile" : "Rider Setup"}
                </Text>
                <Text style={styles.secondaryCardSub}>
                  {riderSetupComplete
                    ? "Edit your pickup location or schedule"
                    : "Set your pickup location and schedule"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCard}
              onPress={() => router.push("/rider/ScheduledRidesRider")}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryCardIcon}>
                <Ionicons name="calendar-outline" size={24} color="#1a3a6b" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.secondaryCardTitle}>Upcoming Rides</Text>
                <Text style={styles.secondaryCardSub}>
                  View your confirmed rides for the week
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Not set up yet */}
      {!role && (
        <View style={styles.emptyState}>
          <Ionicons name="person-circle-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>You're signed in</Text>
          <Text style={styles.emptySub}>
            Go back and choose your role to get started.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.replace("/role")}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyButtonText}>Choose Role</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f8f6f1",
  },
  container: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 28,
  },

  // Header
  header: {
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 2,
  },
  logoMini: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#1a3a6b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#dbeafe",
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a3a6b",
  },

  // Section
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cards: {
    gap: 12,
  },

  // Primary card (filled navy)
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a3a6b",
    borderRadius: 18,
    padding: 20,
    gap: 16,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  primaryCardSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.68)",
    lineHeight: 18,
    marginTop: 2,
  },

  // Secondary card (white)
  secondaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  secondaryCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  secondaryCardSub: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginTop: 2,
  },

  cardContent: {
    flex: 1,
  },

  // Setup prompt card
  setupPromptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#fde68a",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  setupPromptIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  setupPromptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400e",
  },
  setupPromptSub: {
    fontSize: 13,
    color: "#b45309",
    lineHeight: 18,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptySub: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: "#1a3a6b",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
