import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [driverSetupComplete, setDriverSetupComplete] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (!stored) return;
        const parsed = JSON.parse(stored);
        setRole(parsed?.role ?? null);
        setDriverSetupComplete(Boolean(parsed?.driverSetupComplete));
      } catch {
        // ignore and fall back to generic home
      }
    }

    loadUser();
  }, []);

  function goToDriverFlow() {
    // Let drivers reach the offer/matching flow from home.
    router.push("/driver/OfferRide");
  }

  function goToRiderFlow() {
    router.push("/rider/RequestRide");
  }

  const isDriver = role === "driver";
  const isRider = role === "rider";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GusLift!</Text>
      <Text style={styles.subtitle}>
        {isDriver && driverSetupComplete
          ? "You are set up as a driver."
          : isDriver && !driverSetupComplete
            ? "Finish or skip setup and start offering rides."
            : isRider
              ? "You are signed in as a rider."
              : "You're signed in."}
      </Text>

      {isDriver && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/driver/DriverSetup")}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {driverSetupComplete ? "Update Driver Setup" : "Complete Driver Setup"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={goToDriverFlow}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Go to Driver Matching</Text>
          </TouchableOpacity>
        </View>
      )}

      {isRider && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={goToRiderFlow}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Go to Rider Matching</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.testingLink}
        onPress={() => router.push("/role")}
        activeOpacity={0.8}
      >
        <Text style={styles.testingLinkText}>Testing: switch role</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f6f1",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    marginTop: 24,
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  secondaryButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "700",
  },
  testingLink: {
    marginTop: 28,
    paddingVertical: 8,
  },
  testingLinkText: {
    color: "#6b7280",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});