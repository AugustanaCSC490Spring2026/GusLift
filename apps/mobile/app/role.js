import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const VALID_ROLES = new Set(["driver", "rider"]);

const ROLE_OPTIONS = [
  {
    id: "driver",
    icon: "car-sport",
    label: "I'm a Driver",
    description: "Offer rides to campus and help fellow Vikings get to class.",
    filled: true,
  },
  {
    id: "rider",
    icon: "walk",
    label: "I'm a Rider",
    description: "Request a ride and get to class on time, stress-free.",
    filled: false,
  },
];

export default function Role() {
  const router = useRouter();
  const [submittingRole, setSubmittingRole] = useState(null);

  async function chooseRole(role) {
    if (!VALID_ROLES.has(role)) {
      Alert.alert("Invalid role", "Please choose a valid role.");
      return;
    }
    if (submittingRole) return;

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
        router.push("/driver/DriverSetup");
      } else {
        router.replace("/rider/RiderSetup");
      }
    } catch {
      Alert.alert("Error", "Could not save your role. Try again.");
    } finally {
      setSubmittingRole(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoMini}>
          <Ionicons name="car-sport" size={20} color="#ffffff" />
        </View>
        <Text style={styles.title}>How will you ride?</Text>
        <Text style={styles.subtitle}>
          Pick your role — you can always update this later.
        </Text>
      </View>

      {/* Role cards */}
      <View style={styles.cards}>
        {ROLE_OPTIONS.map((option) => {
          const isSubmitting = submittingRole === option.id;
          const isDisabled = Boolean(submittingRole);

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.card,
                option.filled ? styles.cardFilled : styles.cardOutlined,
                isDisabled && !isSubmitting && styles.cardFaded,
              ]}
              onPress={() => chooseRole(option.id)}
              disabled={isDisabled}
              activeOpacity={0.82}
            >
              <View style={[
                styles.iconWrap,
                option.filled ? styles.iconWrapFilled : styles.iconWrapOutlined,
              ]}>
                <Ionicons
                  name={option.icon}
                  size={28}
                  color={option.filled ? "#1a3a6b" : "#ffffff"}
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={[
                  styles.cardLabel,
                  { color: option.filled ? "#ffffff" : "#0f172a" },
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.cardDescription,
                  { color: option.filled ? "rgba(255,255,255,0.72)" : "#64748b" },
                ]}>
                  {option.description}
                </Text>
              </View>

              <View style={[
                styles.arrowWrap,
                { borderColor: option.filled ? "rgba(255,255,255,0.25)" : "#e2e8f0" },
              ]}>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={option.filled ? "#ffffff" : "#1a3a6b"}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footer}>
        Restricted to Augustana College students
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 28,
  },

  // Header
  header: {
    alignItems: "center",
    gap: 10,
  },
  logoMini: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#1a3a6b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },

  // Cards
  cards: {
    width: "100%",
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 18,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardFilled: {
    backgroundColor: "#1a3a6b",
  },
  cardOutlined: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  cardFaded: {
    opacity: 0.5,
  },

  // Icon
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapFilled: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  iconWrapOutlined: {
    backgroundColor: "#1a3a6b",
  },

  // Card body
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
  },

  // Arrow
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
});
