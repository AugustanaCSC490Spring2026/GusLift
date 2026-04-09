import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function App() {
  const router = useRouter();

  async function handleGoToSignup() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        const parsed = JSON.parse(stored);
        const userId = String(parsed?.id || "").trim();
        if (userId) {
          // eslint-disable-next-line no-console
          console.log("[GusLift] Existing signed-in user id:", userId);
        } else {
          // eslint-disable-next-line no-console
          console.log(
            "[GusLift] Existing signed-in user has no id in storage.",
          );
        }
      } else {
        // eslint-disable-next-line no-console
        console.log("[GusLift] No saved user session found.");
      }
    } catch {
      // eslint-disable-next-line no-console
      console.log("[GusLift] Could not read saved user session.");
    }

    router.push("/signup");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GusLift</Text>
      <Text style={styles.subtitle}>This is your home screen.</Text>
      <TouchableOpacity style={styles.button} onPress={handleGoToSignup}>
        <Text style={styles.buttonText}>Go to Sign Up</Text>
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
  },
  button: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
