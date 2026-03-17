import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";
const { height } = Dimensions.get("window");

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState("");

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const webRedirectUriOverride = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI_WEB;
  const platformClientId = Platform.select({
    web: webClientId,
    android: androidClientId,
    ios: iosClientId,
    default: webClientId,
  });
  const isGoogleClientMissing = !platformClientId;
  const platformName = Platform.OS;
  const expectedClientEnvVar = Platform.select({
    web: "EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB",
    android: "EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID",
    ios: "EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS",
    default: "EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB",
  });
  const fallbackRedirectUri = makeRedirectUri({
    scheme: "guslift",
    path: "oauthredirect",
    preferLocalhost: true,
  });
  const redirectUri =
    Platform.OS === "web" && webRedirectUriOverride
      ? webRedirectUriOverride
      : fallbackRedirectUri;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: platformClientId ?? "MISSING_GOOGLE_CLIENT_ID",
    webClientId,
    androidClientId,
    iosClientId,
    redirectUri,
    selectAccount: true,
    extraParams: { hd: SCHOOL_DOMAIN },
  });

  const checkStoredUser = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        let parsed;
        try { parsed = JSON.parse(stored); } catch {
          await AsyncStorage.removeItem("@user"); return;
        }
        if (parsed?.id) console.log("[GusLift] Existing user id:", parsed.id);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - parsed.savedAt > sevenDays;
        if (!isExpired) {
          if (!parsed.role) {
            router.push("/role");
            return;
          }
          router.replace("/home");
        } else {
          await AsyncStorage.removeItem("@user");
        }
      }
    } catch { /* no stored session */ }
  }, [router]);

  useEffect(() => { checkStoredUser(); }, [checkStoredUser]);

  const fetchUserInfo = useCallback(async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const email = (data?.email || "").toLowerCase();
      if (data?.id) console.log("[GusLift] Google user id:", data.id);
      if (!email.endsWith(`@${SCHOOL_DOMAIN}`)) {
        setLoading(false); setDeniedEmail(data.email); setAccessDenied(true); return;
      }
      await AsyncStorage.setItem("@user", JSON.stringify({ ...data, savedAt: Date.now() }));
      if (data?.id) Alert.alert("Google user id", `Copy this id for seeding:\n\n${data.id}`, [{ text: "OK" }]);
      setLoading(false);
      router.push("/role");
    } catch {
      setLoading(false);
      Alert.alert("Error", "Could not fetch your Google profile. Try again.", [{ text: "OK" }]);
    }
  }, [router]);

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.accessToken;
      if (token) { fetchUserInfo(token); }
      else { setLoading(false); Alert.alert("Sign-in Error", "No access token returned."); }
    }
    if (response?.type === "error") {
      setLoading(false); Alert.alert("Sign-in Error", "Google sign-in failed. Please try again.");
    }
  }, [response, fetchUserInfo]);

  if (accessDenied) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.hero}>
          <View style={styles.circle1} /><View style={styles.circle2} /><View style={styles.circle3} />
          <View style={styles.logoWrap}>
            <Ionicons name="car-sport" size={32} color="#ffffff" />
          </View>
          <Text style={styles.brand}>GusLift</Text>
        </View>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.errorIconWrap}>
            <Ionicons name="lock-closed" size={28} color="#1a3a6b" />
          </View>
          <Text style={styles.sheetTitle}>Access Restricted</Text>
          <Text style={styles.sheetSub}>
            <Text style={{ fontWeight: "700", color: "#0a1628" }}>{deniedEmail}</Text>
            {" "}isn't an Augustana account.{"\n"}Use your{" "}
            <Text style={{ fontWeight: "700", color: "#1a3a6b" }}>@augustana.edu</Text> email.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { setAccessDenied(false); setDeniedEmail(""); setLoading(false); }}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={17} color="#fff" />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Dark hero section */}
      <View style={styles.hero}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
        <View style={styles.heroContent}>
          <View style={styles.logoWrap}>
            <Ionicons name="car-sport" size={32} color="#ffffff" />
          </View>
          <Text style={styles.brand}>GusLift</Text>
          <Text style={styles.tagline}>Your campus ride,{"\n"}by Vikings for Vikings.</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Welcome back</Text>
        <Text style={styles.sheetSub}>
          Sign in with your Augustana Google account to continue.
        </Text>

        {isGoogleClientMissing && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={15} color="#92400e" />
            <Text style={styles.warningText}>
              Set {expectedClientEnvVar} in .env and restart Expo.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
          onPress={async () => {
            if (isGoogleClientMissing) {
              Alert.alert("Configuration Error", `Missing ${expectedClientEnvVar}.`); return;
            }
            if (!request) {
              Alert.alert("Not Ready", "Auth request is initializing. Please wait."); return;
            }
            try { setLoading(true); await promptAsync(); }
            catch { setLoading(false); Alert.alert("Sign-in Error", "Could not start Google sign-in."); }
          }}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#1a3a6b" />
          ) : (
            <>
              <View style={styles.googleIconBox}>
                <Ionicons name="logo-google" size={18} color="#4285F4" />
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={13} color="#1a3a6b" />
          <Text style={styles.securityText}>Restricted to @augustana.edu accounts</Text>
        </View>
      </View>
    </View>
  );
}

const HERO_HEIGHT = height * 0.46;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#0f1f3d",
  },

  // Hero
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: "#0f1f3d",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(79,142,247,0.10)",
    top: -80,
    right: -70,
  },
  circle2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -40,
    left: -50,
  },
  circle3: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(79,142,247,0.08)",
    top: 60,
    left: 30,
  },
  heroContent: {
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#1a3a6b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#4f8ef7",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // Bottom sheet
  bottomSheet: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0a1628",
    letterSpacing: -0.4,
  },
  sheetSub: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
    marginTop: -4,
  },

  // Warning
  warningBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "flex-start",
  },
  warningText: { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18 },

  // Google button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleBtnDisabled: { opacity: 0.55 },
  googleIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f8faff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8f0fe",
  },
  googleBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0a1628",
  },

  // Security
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  securityText: { fontSize: 12, color: "#94a3b8" },

  // Primary button (error state)
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a3a6b",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Error icon
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});
