import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import CarIllustration from "../components/CarIllustration";
import RiderIllustration from "../components/RiderIllustration";

/* ─── Color tokens ─── */
const C = {
  brand: "#3B82F6",
  brandDeep: "#1D4ED8",
  brandBg: "#EFF6FF",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E2E8F0",
};

const VALID_ROLES = new Set(["driver", "rider"]);

/* ─── Small inline helpers ─── */
function ChevronRight({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RadioDot({ selected }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected && <View style={styles.radioDot} />}
    </View>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN ROLE SCREEN
   ════════════════════════════════════════════════════════ */
export default function Role() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [driverHovered, setDriverHovered] = useState(false);
  const [riderHovered, setRiderHovered] = useState(false);

  // Card animations
  const driverOpacity = useRef(new Animated.Value(1)).current;
  const riderOpacity = useRef(new Animated.Value(1)).current;
  const driverScale = useRef(new Animated.Value(1)).current;
  const riderScale = useRef(new Animated.Value(1)).current;
  const exitAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);

  // Dim/undim effect
  useEffect(() => {
    if (!selectedRole) {
      Animated.parallel([
        Animated.timing(driverOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(riderOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (selectedRole === "driver") {
      Animated.parallel([
        Animated.timing(driverOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(riderOpacity, { toValue: 0.25, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(driverOpacity, { toValue: 0.25, duration: 250, useNativeDriver: true }),
        Animated.timing(riderOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedRole, driverOpacity, riderOpacity]);

  const selectRole = useCallback((role) => {
    if (launching) return;
    if (selectedRole === role) {
      setSelectedRole(null);
    } else {
      setSelectedRole(role);
    }
  }, [selectedRole, launching]);

  const handleStart = useCallback(async () => {
    if (!selectedRole || launching) return;
    if (!VALID_ROLES.has(selectedRole)) {
      Alert.alert("Invalid role", "Please choose a valid role.");
      return;
    }

    setLaunching(true);

    // Exit animation
    const targetAnim = selectedRole === "driver" ? driverScale : riderScale;
    Animated.parallel([
      Animated.timing(targetAnim, {
        toValue: 0.8,
        duration: 400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(exitAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(async () => {
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

        const updated = { ...parsed, role: selectedRole };
        await AsyncStorage.setItem("@user", JSON.stringify(updated));

        if (selectedRole === "driver") {
          if (parsed.driverSetupComplete) {
            router.push("/driver/DriverHome");
          } else {
            router.push("/driver/DriverSetup");
          }
        } else {
          if (parsed.riderSetupComplete) {
            router.push("/rider/RiderHome");
          } else {
            router.push("/rider/RiderSetup");
          }
        }
      } catch {
        Alert.alert("Error", "Could not save your role. Try again.");
      } finally {
        // Reset state in case user navigates back
        setLaunching(false);
        setSelectedRole(null);
        exitAnim.setValue(0);
        driverScale.setValue(1);
        riderScale.setValue(1);
      }
    });
  }, [selectedRole, launching, router, driverScale, riderScale, exitAnim]);

  const driverExitTranslateX = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const riderExitTranslateY = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -400],
  });

  const buttonLabel = !selectedRole
    ? "Start Journey"
    : launching
    ? "Taking off!"
    : selectedRole === "driver"
    ? "Drive now"
    : "Find a ride";

  const isButtonActive = !!selectedRole && !launching;

  return (
    <Animated.View style={[styles.screen, { opacity: fadeIn }]}>
      {/* Heading */}
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>Choose your role</Text>
        <Text style={styles.headingSubtitle}>
          Select your mode to start your journey.
        </Text>
      </View>

      {/* Cards */}
      <View style={styles.cards}>
        {/* DRIVER CARD */}
        <Animated.View
          style={[
            {
              flex: 1,
              opacity: driverOpacity,
              transform: [
                { scale: driverScale },
                ...(selectedRole === "driver" && launching
                  ? [{ translateX: driverExitTranslateX }]
                  : []),
              ],
            },
          ]}
        >
          <Pressable
            style={[
              styles.roleCard,
              selectedRole === "driver" && styles.roleCardSelected,
            ]}
            onPress={() => selectRole("driver")}
            onHoverIn={() => setDriverHovered(true)}
            onHoverOut={() => setDriverHovered(false)}
            onPressIn={() => setDriverHovered(true)}
            onPressOut={() => setDriverHovered(false)}
            disabled={launching || (selectedRole && selectedRole !== "driver")}
          >
            <CarIllustration isHovered={driverHovered || selectedRole === "driver"} />
            <View style={styles.cardFooter}>
              <View style={styles.cardText}>
                <Text
                  style={[
                    styles.cardTitle,
                    selectedRole === "driver" && styles.cardTitleSelected,
                  ]}
                >
                  I'm a driver
                </Text>
                <Text style={styles.cardDesc}>
                  Earn money by sharing your ride with others.
                </Text>
              </View>
              <RadioDot selected={selectedRole === "driver"} />
            </View>
          </Pressable>
        </Animated.View>

        {/* RIDER CARD */}
        <Animated.View
          style={[
            {
              flex: 1,
              opacity: riderOpacity,
              transform: [
                { scale: riderScale },
                ...(selectedRole === "rider" && launching
                  ? [{ translateY: riderExitTranslateY }]
                  : []),
              ],
            },
          ]}
        >
          <Pressable
            style={[
              styles.roleCard,
              selectedRole === "rider" && styles.roleCardSelected,
            ]}
            onPress={() => selectRole("rider")}
            onHoverIn={() => setRiderHovered(true)}
            onHoverOut={() => setRiderHovered(false)}
            onPressIn={() => setRiderHovered(true)}
            onPressOut={() => setRiderHovered(false)}
            disabled={launching || (selectedRole && selectedRole !== "rider")}
          >
            <RiderIllustration isHovered={riderHovered || selectedRole === "rider"} />
            <View style={styles.cardFooter}>
              <View style={styles.cardText}>
                <Text
                  style={[
                    styles.cardTitle,
                    selectedRole === "rider" && styles.cardTitleSelected,
                  ]}
                >
                  I'm a rider
                </Text>
                <Text style={styles.cardDesc}>
                  Fast, affordable commutes.
                </Text>
              </View>
              <RadioDot selected={selectedRole === "rider"} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* START BUTTON */}
      <Pressable
        style={[
          styles.startBtn,
          isButtonActive && styles.startBtnActive,
          launching && styles.startBtnLaunching,
        ]}
        onPress={handleStart}
        disabled={!selectedRole || launching}
      >
        <Text
          style={[
            styles.startBtnText,
            isButtonActive && styles.startBtnTextActive,
            launching && styles.startBtnTextActive,
          ]}
        >
          {buttonLabel}
        </Text>
        <ChevronRight color={isButtonActive || launching ? "#fff" : C.subtle} />
      </Pressable>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  /* Heading */
  heading: {
    alignItems: "center",
    marginBottom: 32,
  },
  headingTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  headingSubtitle: {
    fontSize: 16,
    color: C.muted,
    fontWeight: "500",
    textAlign: "center",
  },

  /* Cards container */
  cards: {
    width: "100%",
    maxWidth: 700,
    flexDirection: "row",
    gap: 18,
  },

  /* Role card */
  roleCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.card,
    backgroundColor: C.card,
    padding: 16,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "border-color 0.25s, box-shadow 0.25s, transform 0.15s",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },
  roleCardSelected: {
    borderColor: C.brand,
    backgroundColor: C.brandBg,
  },

  /* Card footer */
  cardFooter: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  cardText: {
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.text,
    textAlign: "center",
  },
  cardTitleSelected: {
    color: C.brand,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: "500",
    color: C.subtle,
    marginTop: 3,
    textAlign: "center",
  },

  /* Radio button */
  radio: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: C.brand,
    backgroundColor: C.brand,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
  },

  /* Start button */
  startBtn: {
    width: "100%",
    maxWidth: 700,
    height: 56,
    borderRadius: 8,
    backgroundColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    ...Platform.select({
      web: {
        cursor: "not-allowed",
        transition: "background 0.3s, color 0.3s, box-shadow 0.3s, transform 0.15s",
      },
      default: {},
    }),
  },
  startBtnActive: {
    backgroundColor: C.brand,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(59,130,246,0.35)",
      },
      default: {
        shadowColor: C.brand,
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      },
    }),
  },
  startBtnLaunching: {
    backgroundColor: C.brandDeep,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "900",
    color: C.subtle,
  },
  startBtnTextActive: {
    color: "#fff",
  },
});
