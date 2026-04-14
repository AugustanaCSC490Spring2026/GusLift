import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

/* ─── Color tokens (matching the HTML mockup) ─── */
const C = {
  brand: "#3B82F6",
  brandLight: "rgba(59,130,246,0.12)",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

/* ─── Interactive Leaflet map (embedded via iframe on web, wide only) ─── */
const LEAFLET_MAP_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;border-radius:16px;}
.leaflet-control-zoom a{width:28px!important;height:28px!important;line-height:28px!important;font-size:14px!important;}
.leaflet-control-attribution{font-size:9px!important;padding:2px 5px!important;}
</style>
</head><body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var map=L.map('map',{zoomControl:false,zoomSnap:0.1}).setView([41.5015,-90.5485],16);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
  attribution:'OpenStreetMap CARTO',maxZoom:20}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
</script>
</body></html>`;

/* ─── Hoverable Button ─── */
function HoverButton({ style, textStyle, label, onPress, hoverBg, hoverText }) {
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

export default function Welcome() {
  const router = useRouter();
  const { preview } = useLocalSearchParams();
  const [ready, setReady] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth > 850;
  const [pickup, setPickup] = useState("Augustana College");
  const [destination, setDestination] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  /**
   * Smart route handler.
   * Checks if user has a stored session, then routes based on desired role.
   * If no session, sends them to signup with the role pre-set.
   * @param {string} desiredRole - "rider" | "driver" | null (null = just log in)
   * @param {object} [extraParams] - optional params to pass (e.g. pickup/destination)
   */
  const smartRoute = useCallback(async (desiredRole, extraParams) => {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        let parsed;
        try {
          parsed = JSON.parse(stored);
        } catch {
          await AsyncStorage.removeItem("@user");
          router.push({ pathname: "/signup", params: { role: desiredRole || undefined, ...(extraParams || {}) } });
          return;
        }

        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt > sevenDays) {
          await AsyncStorage.removeItem("@user");
          router.push({ pathname: "/signup", params: { role: desiredRole || undefined, ...(extraParams || {}) } });
          return;
        }

        // User has a valid session
        const role = desiredRole || parsed.role;

        // Update role if switching
        if (role && role !== parsed.role) {
          const updated = { ...parsed, role };
          await AsyncStorage.setItem("@user", JSON.stringify(updated));
        }

        if (!role) {
          router.push("/role");
          return;
        }

        if (role === "driver") {
          router.push(parsed.driverSetupComplete ? "/driver/OfferRide" : "/driver/DriverSetup");
        } else {
          // Riders go straight to RequestRide — pass any landing page params
          router.push({ pathname: "/rider/RequestRide", params: extraParams || {} });
        }
      } else {
        // No session — go sign up with role hint + landing page params
        router.push({ pathname: "/signup", params: { role: desiredRole || undefined, ...(extraParams || {}) } });
      }
    } catch {
      router.push("/signup");
    }
  }, [router]);

  /* ─── Session auto-redirect ─── */
  const checkStoredUser = useCallback(async () => {
    if (preview) {
      setReady(true);
      return;
    }
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        let parsed;
        try {
          parsed = JSON.parse(stored);
        } catch {
          await AsyncStorage.removeItem("@user");
          setReady(true);
          return;
        }
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt <= sevenDays) {
          if (!parsed.role) {
            router.replace("/role");
            return;
          }
          if (parsed.role === "driver") {
            router.replace(
              parsed.driverSetupComplete
                ? "/driver/OfferRide"
                : "/driver/DriverSetup"
            );
          } else {
            // Riders go straight to RequestRide — rider setup is optional
            router.replace("/rider/RequestRide");
          }
          return;
        } else {
          await AsyncStorage.removeItem("@user");
        }
      }
    } catch {
      // No stored session
    }
    setReady(true);
  }, [router, preview]);

  useEffect(() => {
    checkStoredUser();
  }, [checkStoredUser]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [ready, fadeAnim]);

  if (!ready) return null;

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* ── NAV ── */}
      <View style={styles.nav}>
        <Pressable style={styles.logoGroup} onPress={() => router.push({ pathname: "/", params: { preview: "true" } })}>
          <Text style={styles.logoText}>GusLift</Text>
        </Pressable>

        <View style={styles.navLinks}>
          <HoverButton
            style={styles.navLinkBtn}
            textStyle={styles.navLinkText}
            label="Ride"
            onPress={() => smartRoute("rider")}
            hoverText={C.brand}
          />
          <HoverButton
            style={styles.navLinkBtn}
            textStyle={styles.navLinkText}
            label="Drive"
            onPress={() => smartRoute("driver")}
            hoverText={C.brand}
          />
          <HoverButton
            style={styles.navLinkBtn}
            textStyle={styles.navLinkText}
            label="About"
            onPress={() => router.push("/About")}
            hoverText={C.brand}
          />
        </View>

        <View style={styles.authButtons}>
          <HoverButton
            style={styles.loginBtn}
            textStyle={styles.loginBtnText}
            label="Log in"
            onPress={() => smartRoute(null)}
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

      {/* ── HERO ── */}
      <View style={[styles.hero, isWide && styles.heroWide]}>
        {/* Left: Content */}
        <View style={[styles.heroContent, isWide && styles.heroContentWide]}>
          <Text style={[styles.heroTitle, !isWide && styles.heroTitleSmall]}>
            Class is far.{"\n"}The weather is mid.
          </Text>
          <Text
            style={[
              styles.heroTitleAccent,
              !isWide && styles.heroTitleAccentSmall,
            ]}
          >
            Take a GusLift.
          </Text>
          <Text style={[styles.heroSubtitle, !isWide && styles.heroSubtitleSmall]}>
            Student carpooling for your campus. Because getting to class
            shouldn't be the hardest part of your day.
          </Text>

          {/* Ride Form */}
          <View style={styles.rideForm}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>PICKUP</Text>
              <View style={styles.inputRow}>
                <View style={styles.iconPickup}>
                  <View style={styles.iconPickupDot} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Pickup location"
                  placeholderTextColor="#94A3B8"
                  value={pickup}
                  onChangeText={setPickup}
                />
              </View>
            </View>

            <View style={[styles.inputWrapper, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>DESTINATION</Text>
              <View style={styles.inputRow}>
                <View style={styles.iconDest}>
                  <View style={styles.iconDestDot} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Where to? (e.g. Olin Center)"
                  placeholderTextColor="#94A3B8"
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>

            <HoverButton
              style={styles.findRideBtn}
              textStyle={styles.findRideBtnText}
              label="Find a ride"
              onPress={() => smartRoute("rider", { pickup, destination })}
            />
          </View>
        </View>

        {/* Right: Map (wide screens only) */}
        {isWide && (
          <View style={styles.heroGraphic}>
            <View style={styles.mapWindow}>
              <iframe
                srcDoc={LEAFLET_MAP_HTML}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: 16,
                }}
                title="Campus Map"
              />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.card,
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

  logoText: {
    fontSize: 21,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
  },
  navLinks: {
    flexDirection: "row",
    gap: 24,
  },
  navLinkBtn: {
    ...Platform.select({
      web: { cursor: "pointer" },
      default: {},
    }),
  },
  navLinkText: {
    fontSize: 15,
    fontWeight: "500",
    color: C.muted,
    ...Platform.select({
      web: { transition: "color 0.2s ease" },
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

  /* ── HERO ── fills remaining space below nav */
  hero: {
    flex: 1,
    flexDirection: "column",
  },
  heroWide: {
    flexDirection: "row",
  },
  heroContent: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  heroContentWide: {
    paddingHorizontal: 44,
    paddingVertical: 32,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#000000",
    lineHeight: 43,
    letterSpacing: -1,
  },
  heroTitleSmall: {
    fontSize: 24,
    lineHeight: 32,
  },
  heroTitleAccent: {
    fontSize: 36,
    fontWeight: "800",
    color: C.brand,
    lineHeight: 44,
    letterSpacing: -1,
    marginTop: 2,
    marginBottom: 12,
  },
  heroTitleAccentSmall: {
    fontSize: 24,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: C.muted,
    marginBottom: 22,
    maxWidth: 420,
  },
  heroSubtitleSmall: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  /* ── RIDE FORM ── */
  rideForm: {
    backgroundColor: C.card,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: 380,
    ...Platform.select({
      web: { boxShadow: "0 4px 20px rgba(0,0,0,0.05)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconPickup: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.text,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  iconPickupDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.text,
  },
  iconDest: {
    width: 16,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.text,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  iconDestDot: {
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    padding: 10,
    paddingLeft: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    fontSize: 14,
    color: C.text,
    ...Platform.select({
      web: {
        outlineStyle: "none",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      },
      default: {},
    }),
  },
  findRideBtn: {
    backgroundColor: C.brand,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    ...Platform.select({
      web: { cursor: "pointer", transition: "all 0.25s ease" },
      default: {},
    }),
  },
  findRideBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* ── MAP AREA (wide only) ── */
  heroGraphic: {
    flex: 1.2,
    backgroundColor: C.card,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  mapWindow: {
    width: "90%",
    height: "85%",
    maxWidth: 520,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    ...Platform.select({
      web: { boxShadow: "0 8px 30px rgba(0,0,0,0.1)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      },
    }),
  },
});
