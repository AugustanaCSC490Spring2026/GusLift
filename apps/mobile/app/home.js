import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [driverSetupComplete, setDriverSetupComplete] = useState(false);
  const [riderSetupComplete, setRiderSetupComplete] = useState(false);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);

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
        setUserEmail(parsed?.email ?? null);
      } catch { /* ignore */ }
    }
    loadUser();
  }, []);

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  function getFormattedDate() {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
    });
  }

  const isDriver = role === "driver";
  const isRider = role === "rider";

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("@user");
          setProfileVisible(false);
          router.replace("/signup");
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* ── Dark header ── */}
      <View style={styles.header}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        <View style={styles.headerTop}>
          <View style={styles.logoMark}>
            <Ionicons name="car-sport" size={18} color="#fff" />
          </View>
          <View style={styles.headerTopRight}>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => setProfileVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.greeting}>
          {getGreeting()}{userName ? `,` : ""}
        </Text>
        {userName && <Text style={styles.greetingName}>{userName} 👋</Text>}

        {role && (
          <View style={styles.rolePill}>
            <View style={[styles.roleDot, { backgroundColor: isDriver ? "#22c55e" : "#4f8ef7" }]} />
            <Text style={styles.rolePillText}>{isDriver ? "Driver" : "Rider"}</Text>
          </View>
        )}
      </View>

      {/* ── Light body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── DRIVER FLOW ── */}
        {isDriver && (
          <>
            {/* Setup warning */}
            {!driverSetupComplete && (
              <TouchableOpacity
                style={styles.warningBanner}
                onPress={() => router.push("/driver/DriverSetup")}
                activeOpacity={0.85}
              >
                <Ionicons name="alert-circle" size={18} color="#d97706" />
                <Text style={styles.warningBannerText}>
                  Complete your driver setup to start offering rides
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#d97706" />
              </TouchableOpacity>
            )}

            {/* Primary CTA */}
            <TouchableOpacity
              style={styles.primaryCard}
              onPress={() => router.push("/driver/OfferRide")}
              activeOpacity={0.88}
            >
              <View style={styles.primaryCardInner}>
                <View style={styles.primaryIconWrap}>
                  <Ionicons name="navigate" size={28} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryCardLabel}>Ready to drive?</Text>
                  <Text style={styles.primaryCardTitle}>Go Online</Text>
                  <Text style={styles.primaryCardSub}>
                    Match with riders heading to campus
                  </Text>
                </View>
              </View>
              <View style={styles.primaryCardFooter}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Tap to go online</Text>
                <Ionicons name="arrow-forward-circle" size={22} color="rgba(255,255,255,0.7)" />
              </View>
            </TouchableOpacity>

            {/* Secondary grid */}
            <View style={styles.grid}>
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => router.push("/driver/DriverSetup")}
                activeOpacity={0.85}
              >
                <View style={styles.gridIconWrap}>
                  <Ionicons
                    name={driverSetupComplete ? "checkmark-circle" : "settings-outline"}
                    size={22}
                    color={driverSetupComplete ? "#22c55e" : "#1a3a6b"}
                  />
                </View>
                <Text style={styles.gridCardTitle}>
                  {driverSetupComplete ? "My Profile" : "Setup"}
                </Text>
                <Text style={styles.gridCardSub}>
                  {driverSetupComplete ? "Edit vehicle & schedule" : "Add vehicle info"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => router.push("/driver/ScheduledRidesDriver")}
                activeOpacity={0.85}
              >
                <View style={styles.gridIconWrap}>
                  <Ionicons name="calendar-outline" size={22} color="#1a3a6b" />
                </View>
                <Text style={styles.gridCardTitle}>My Rides</Text>
                <Text style={styles.gridCardSub}>View upcoming rides</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── RIDER FLOW ── */}
        {isRider && (
          <>
            {/* Setup warning */}
            {!riderSetupComplete && (
              <TouchableOpacity
                style={styles.warningBanner}
                onPress={() => router.push("/rider/RiderSetup")}
                activeOpacity={0.85}
              >
                <Ionicons name="alert-circle" size={18} color="#d97706" />
                <Text style={styles.warningBannerText}>
                  Add your pickup location to start requesting rides
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#d97706" />
              </TouchableOpacity>
            )}

            {/* Uber-style "Where to?" */}
            <TouchableOpacity
              style={styles.whereToBtn}
              onPress={() => router.push("/rider/RequestRide")}
              activeOpacity={0.88}
            >
              <View style={styles.whereToIcon}>
                <Ionicons name="search" size={20} color="#1a3a6b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whereToLabel}>Where to?</Text>
                <Text style={styles.whereToSub}>Request a ride to campus</Text>
              </View>
              <View style={styles.whereToArrow}>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Secondary grid */}
            <View style={styles.grid}>
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => router.push("/rider/RiderSetup")}
                activeOpacity={0.85}
              >
                <View style={styles.gridIconWrap}>
                  <Ionicons
                    name={riderSetupComplete ? "checkmark-circle" : "settings-outline"}
                    size={22}
                    color={riderSetupComplete ? "#22c55e" : "#1a3a6b"}
                  />
                </View>
                <Text style={styles.gridCardTitle}>
                  {riderSetupComplete ? "My Profile" : "Setup"}
                </Text>
                <Text style={styles.gridCardSub}>
                  {riderSetupComplete ? "Edit pickup & schedule" : "Add pickup info"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => router.push("/rider/ScheduledRidesRider")}
                activeOpacity={0.85}
              >
                <View style={styles.gridIconWrap}>
                  <Ionicons name="calendar-outline" size={22} color="#1a3a6b" />
                </View>
                <Text style={styles.gridCardTitle}>My Rides</Text>
                <Text style={styles.gridCardSub}>View upcoming rides</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── NO ROLE ── */}
        {!role && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="person-circle-outline" size={52} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>Choose your role</Text>
            <Text style={styles.emptySub}>
              Tell us how you'll be using GusLift
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.replace("/role")}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Profile / Settings modal */}
      <Modal
        visible={profileVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileVisible(false)}
        >
          <View style={styles.profileSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            {/* User info */}
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={28} color="#1a3a6b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{userName ?? "Augustana Student"}</Text>
                <Text style={styles.profileEmail}>{userEmail ?? ""}</Text>
              </View>
              {role && (
                <View style={styles.profileRolePill}>
                  <Text style={styles.profileRoleText}>{isDriver ? "Driver" : "Rider"}</Text>
                </View>
              )}
            </View>

            <View style={styles.sheetDivider} />

            {/* Options */}
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setProfileVisible(false);
                router.push(isDriver ? "/driver/DriverSetup" : "/rider/RiderSetup");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.sheetRowIcon}>
                <Ionicons name="settings-outline" size={20} color="#1a3a6b" />
              </View>
              <Text style={styles.sheetRowText}>Edit Profile & Setup</Text>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setProfileVisible(false);
                router.push("/role");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.sheetRowIcon}>
                <Ionicons name="swap-horizontal-outline" size={20} color="#1a3a6b" />
              </View>
              <Text style={styles.sheetRowText}>Switch Role</Text>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetRowIcon, styles.sheetRowIconDanger]}>
                <Ionicons name="log-out-outline" size={20} color="#dc2626" />
              </View>
              <Text style={styles.sheetRowTextDanger}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f5f0" },

  // Header
  header: {
    backgroundColor: "#0f1f3d",
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 4,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute", width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(79,142,247,0.08)", top: -60, right: -60,
  },
  circle2: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.03)", bottom: -40, left: 20,
  },
  headerTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  headerTopRight: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1a3a6b", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  dateText: { fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: "500" },
  profileBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  greeting: { fontSize: 16, color: "rgba(255,255,255,0.6)", fontWeight: "500" },
  greetingName: {
    fontSize: 30, fontWeight: "800", color: "#ffffff",
    letterSpacing: -0.5, marginTop: 2,
  },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 999, alignSelf: "flex-start", marginTop: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  rolePillText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)" },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 14, paddingBottom: 40 },

  // Warning banner
  warningBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fffbeb", borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: "#fde68a",
  },
  warningBannerText: { flex: 1, fontSize: 13, color: "#92400e", fontWeight: "500", lineHeight: 18 },

  // Primary driver card
  primaryCard: {
    backgroundColor: "#1a3a6b",
    borderRadius: 22, padding: 22, gap: 18,
    shadowColor: "#1a3a6b", shadowOpacity: 0.35,
    shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  primaryCardInner: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  primaryIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  primaryCardLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  primaryCardTitle: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: -0.3, marginTop: 2 },
  primaryCardSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3, lineHeight: 18 },
  primaryCardFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 14,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  onlineText: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: "500" },

  // "Where to?" rider button
  whereToBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 14,
    borderWidth: 1.5, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  whereToIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center",
  },
  whereToLabel: { fontSize: 20, fontWeight: "800", color: "#0a1628", letterSpacing: -0.3 },
  whereToSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  whereToArrow: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "#1a3a6b", alignItems: "center", justifyContent: "center",
  },

  // Grid
  grid: { flexDirection: "row", gap: 12 },
  gridCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 6,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.04,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  gridIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  gridCardTitle: { fontSize: 14, fontWeight: "700", color: "#0a1628" },
  gridCardSub: { fontSize: 12, color: "#64748b", lineHeight: 17 },

  // Profile modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,22,40,0.5)",
    justifyContent: "flex-end",
  },
  profileSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 4,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 16,
  },
  profileHeader: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  profileName: { fontSize: 17, fontWeight: "700", color: "#0a1628" },
  profileEmail: { fontSize: 13, color: "#64748b", marginTop: 2 },
  profileRolePill: {
    backgroundColor: "#dbeafe", paddingVertical: 4,
    paddingHorizontal: 12, borderRadius: 999,
  },
  profileRoleText: { fontSize: 12, fontWeight: "700", color: "#1a3a6b" },
  sheetDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 8 },
  sheetRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14,
  },
  sheetRowIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center",
  },
  sheetRowIconDanger: { backgroundColor: "#fef2f2" },
  sheetRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0a1628" },
  sheetRowTextDanger: { flex: 1, fontSize: 15, fontWeight: "600", color: "#dc2626" },

  // Empty state
  emptyState: {
    alignItems: "center", gap: 10,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#0a1628" },
  emptySub: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 21 },
  emptyBtn: {
    marginTop: 8, flexDirection: "row", alignItems: "center",
    backgroundColor: "#1a3a6b", paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: 14, gap: 8,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
