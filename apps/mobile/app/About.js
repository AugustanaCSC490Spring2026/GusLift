import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

/* ─── Color tokens ─── */
const C = {
  brand: "#3B82F6",
  brandLight: "rgba(59,130,246,0.12)",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

/* ─── Feature data ─── */
const FEATURES = [
  {
    emoji: "🛡️",
    title: "Safety First",
    desc: "Every user is verified through their campus SSO or @augustana.edu email. Travel with peace of mind.",
  },
  {
    emoji: "📅",
    title: "Schedule-Based",
    desc: "We match you with people already heading to your building at the same time. No out-of-the-way detours.",
  },
  {
    emoji: "💸",
    title: "Affordable",
    desc: "With small contributions, it's a sustainable alternative to expensive short-trip Ubers.",
  },
  {
    emoji: "🤝",
    title: "Community",
    desc: "GusLift isn't a gig-driving platform, it's a carpooling community. Turn a commute into a connection.",
  },
];

/* ─── Hoverable Button Component ─── */
function HoverButton({
  style,
  textStyle,
  label,
  onPress,
  hoverBg,
  hoverText,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  const onHoverIn = () => {
    setHovered(true);
    Animated.spring(scale, {
      toValue: 1.03,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const onHoverOut = () => {
    setHovered(false);
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={{ alignSelf: style?.alignSelf }}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale }] },
          hovered && hoverBg ? { backgroundColor: hoverBg } : null,
        ]}
      >
        <Text
          style={[
            textStyle,
            hovered && hoverText ? { color: hoverText } : null,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function About() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth > 850;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── NAV ── */}
        <View style={styles.nav}>
          <Pressable style={styles.logoGroup} onPress={() => router.push("/")}>
            <View style={styles.logoBox}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <Text style={styles.logoText}>GusLift</Text>
          </Pressable>

          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push("/")}>
              <Text style={styles.navLink}>Ride</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/")}>
              <Text style={styles.navLink}>Drive</Text>
            </Pressable>
            <Pressable>
              <Text style={[styles.navLink, styles.navLinkActive]}>About</Text>
            </Pressable>
          </View>

          <View style={styles.authButtons}>
            <HoverButton
              style={styles.loginBtn}
              textStyle={styles.loginBtnText}
              label="Log in"
              onPress={() => router.push("/signup")}
              hoverBg={C.brandLight}
              hoverText={C.brand}
            />
            <HoverButton
              style={styles.signupBtn}
              textStyle={styles.signupBtnText}
              label="Sign Up"
              onPress={() => router.push("/signup")}
            />
          </View>
        </View>

        {/* ── ABOUT CONTENT ── */}
        <View style={styles.aboutContainer}>
          <View style={styles.sectionTagContainer}>
            <Text style={styles.sectionTag}>Our Mission</Text>
          </View>
          <Text style={styles.aboutTitle}>
            Built by Students – For Students.
          </Text>
          <Text style={styles.aboutText}>
            College campuses are built around walking, but distance and weather
            shouldn't be a barrier to your education. Whether it's an early 8:00
            AM lab in Olin Center or a late-night study session during a Midwest
            winter,{" "}
            <Text style={{ fontWeight: "700" }}>GusLift</Text> was created to
            ensure no student is left out in the cold.
          </Text>

          <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={styles.featureTitleRow}>
                  <Text style={styles.featureEmoji}>{f.emoji}</Text>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                </View>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.howItWorks}>
            <Text style={styles.howTitle}>How It Works</Text>
            <Text style={styles.howText}>
              Drivers post their existing commutes, and riders join for a small
              fee. By syncing your class schedule, the app does the heavy lifting
              of finding the perfect match so you can focus on your studies.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.card,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* ── NAV ── */
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logoGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...Platform.select({
      web: { cursor: "pointer" },
      default: {},
    }),
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: `0 4px 10px ${C.brandLight}` },
      default: {
        shadowColor: C.brand,
        shadowOpacity: 0.25,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },
  logoText: {
    fontSize: 21,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
  },
  navLinks: {
    flexDirection: "row",
    gap: 30,
  },
  navLink: {
    fontSize: 15,
    fontWeight: "500",
    color: C.muted,
    ...Platform.select({
      web: { cursor: "pointer", transition: "color 0.2s ease" },
      default: {},
    }),
  },
  navLinkActive: {
    color: C.brand,
  },
  authButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  loginBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: "pointer", transition: "all 0.25s ease" },
      default: {},
    }),
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  signupBtn: {
    backgroundColor: C.brand,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: "pointer", transition: "all 0.25s ease" },
      default: {},
    }),
  },
  signupBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  /* ── ABOUT ── */
  aboutContainer: {
    padding: 48,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  sectionTagContainer: {
    flexDirection: "row",
    marginBottom: 14,
  },
  sectionTag: {
    backgroundColor: C.brandLight,
    color: C.brand,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: "700",
    overflow: "hidden",
  },
  aboutTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: C.text,
    marginBottom: 22,
    letterSpacing: -0.5,
  },
  aboutText: {
    fontSize: 17,
    lineHeight: 29,
    color: C.text,
    marginBottom: 40,
  },
  featureGrid: {
    gap: 20,
    marginBottom: 48,
  },
  featureGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  featureItem: {
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: {
        flex: "1 1 45%",
        minWidth: 260,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        cursor: "default",
      },
      default: { width: "100%" },
    }),
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 23,
    color: C.muted,
  },
  howItWorks: {
    backgroundColor: C.bg,
    padding: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  howTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    marginBottom: 18,
  },
  howText: {
    fontSize: 15,
    lineHeight: 26,
    color: C.muted,
  },
});
