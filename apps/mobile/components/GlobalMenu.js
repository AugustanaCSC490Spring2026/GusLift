import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GlobalMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentRole, setCurrentRole] = useState(null);

  // Do not show the menu on login/signup pages
  const hidePaths = ["/", "/index", "/signup", "/role", "/about"];
  if (hidePaths.includes(pathname)) {
    return null;
  }

  const toggleMenu = async () => {
    if (!isOpen) {
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setCurrentRole(parsed?.role);
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
        style={[styles.menuButton, { top: insets.top + 10 }]}
        onPress={toggleMenu}
        activeOpacity={0.8}
      >
        <Ionicons name="menu" size={32} color="#1f2937" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={toggleMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Menu</Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleSwitchRole}>
              <Ionicons name="swap-horizontal" size={24} color="#1f2937" />
              <Text style={styles.menuItemText}>
                {currentRole === "driver" ? "Change to Rider" : "Change to Driver"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsOpen(false); router.push("/developer"); }}>
              <Ionicons name="code-slash-outline" size={24} color="#1f2937" />
              <Text style={styles.menuItemText}>
                Developer Options
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSignout}>
              <Ionicons name="log-out-outline" size={24} color="#dc2626" />
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
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    width: 250,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1f2937",
    textAlign: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#1f2937",
    fontWeight: "500",
  },
});
