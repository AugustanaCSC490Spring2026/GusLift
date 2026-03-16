import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const VALID_ROLES = new Set(["driver", "rider"]);

export default function Role() {
  const router = useRouter();
  const [submittingRole, setSubmittingRole] = useState(null);

  async function chooseRole(role) {
    if (!VALID_ROLES.has(role)) {
      Alert.alert("Invalid role", "Please choose a valid role.");
      return;
    }

    if (submittingRole) {
      return;
    }

    setSubmittingRole(role);

    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        await AsyncStorage.removeItem("@user");
        Alert.alert("Session error", "Please sign in again.");
        router.replace("/signup");
        return;
      }

      const updated = { ...parsed, role };
      await AsyncStorage.setItem("@user", JSON.stringify(updated));

      if (role === "driver") {
        router.replace("/driver-setup");
      } else {
        router.replace("/home");
      }
    } catch {
      Alert.alert("Error", "Could not save your role. Try again.");
    } finally {
      setSubmittingRole(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your role</Text>
      <Text style={styles.subtitle}>
        This helps GusLift show you the right features.
      </Text>

      <TouchableOpacity
        style={[styles.button, submittingRole && styles.buttonDisabled]}
        onPress={() => chooseRole("driver")}
        disabled={Boolean(submittingRole)}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>I am a Driver</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, submittingRole && styles.buttonDisabled]}
        onPress={() => chooseRole("rider")}
        disabled={Boolean(submittingRole)}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>I am a Rider</Text>
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
    gap: 12,
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
    marginBottom: 14,
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
