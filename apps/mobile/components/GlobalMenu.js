import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from "react-native-svg";
import MenuAvatar from "./MenuAvatar";

// Custom SVG Icons
function CarIcon({ size = 20, color = "#64748B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 14l2-8a2 2 0 012-1.5h10A2 2 0 0121 6l2 8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={7.5} cy={14.5} r={1.5} fill={color} />
      <Circle cx={16.5} cy={14.5} r={1.5} fill={color} />
    </Svg>
  );
}

function HistoryIcon({ size = 20, color = "#64748B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CodeIcon({ size = 20, color = "#64748B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LogOutIcon({ size = 20, color = "#dc2626" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function GlobalMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentRole, setCurrentRole] = useState(null);
  const [avatarUri, setAvatarUri] = useState(null);

  // Do not show the menu on login/signup/setup pages
  const hidePaths = ["/", "/index", "/signup", "/role", "/About"];
  if (hidePaths.includes(pathname) || pathname?.toLowerCase().includes("setup")) {
    return null;
  }

  const toggleMenu = async () => {
    if (!isOpen) {
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setCurrentRole(parsed?.role);
          setAvatarUri(parsed?.picture || parsed?.avatar_url || null);
        }
      } catch (e) {
        // ignore
      }
    }
    setIsOpen(!isOpen);
  };

  const handleSignout = async () => {
    setIsOpen(false);
    try {
      await AsyncStorage.removeItem("@user");
      router.replace("/");
    } catch (e) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  const handleSwitchRole = async () => {
    setIsOpen(false);
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }

      const parsed = JSON.parse(stored);
      const newRole = currentRole === "driver" ? "rider" : "driver";
      const updated = { ...parsed, role: newRole };
      await AsyncStorage.setItem("@user", JSON.stringify(updated));

      if (newRole === "driver") {
        if (parsed.driverSetupComplete) {
          router.replace("/driver/OfferRide");
        } else {
          router.replace("/driver/DriverSetup");
        }
      } else {
        // Riders go straight to RequestRide — rider setup is optional
        router.replace("/rider/RequestRide");
      }
    } catch (e) {
      Alert.alert("Error", "Could not switch role.");
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.menuButton, { top: insets.top + (Platform.OS === 'web' ? 20 : 10) }]}
        onPress={toggleMenu}
        activeOpacity={0.8}
      >
        <MenuAvatar uri={avatarUri} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
            
            {/* Menu Items */}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsOpen(false); /* add route later */ }}>
              <CarIcon size={20} color="#64748B" />
              <Text style={styles.menuItemText}>
                Upcoming Rides
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsOpen(false); /* add route later */ }}>
              <HistoryIcon size={20} color="#64748B" />
              <Text style={styles.menuItemText}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsOpen(false); router.push("/Developer"); }}>
              <CodeIcon size={20} color="#64748B" />
              <Text style={styles.menuItemText}>
                Developer Options
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSignout}>
              <LogOutIcon size={20} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    position: "absolute",
    right: 20,
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end", // slide from bottom or center
    alignItems: "center",
  },
  menuContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 40,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#1f2937",
    fontWeight: "500",
  },
});
