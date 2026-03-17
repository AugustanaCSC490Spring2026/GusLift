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
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";

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
        try {
          parsed = JSON.parse(stored);
        } catch {
          await AsyncStorage.removeItem("@user");
          return;
        }
        if (parsed?.id) {
          console.log("[GusLift] Existing Google user id (from storage):", parsed.id);
        }
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
    } catch {
      // No stored session
    }
  }, [router]);

  useEffect(() => {
    checkStoredUser();
  }, [checkStoredUser]);

  const fetchUserInfo = useCallback(async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const email = (data?.email || "").toLowerCase();
      if (data?.id) {
        console.log("[GusLift] Google user id (sub):", data.id);
      }
      if (!email.endsWith(`@${SCHOOL_DOMAIN}`)) {
        setLoading(false);
        setDeniedEmail(data.email);
        setAccessDenied(true);
        return;
      }
      console.log("Google user signed in:", data?.id);
      await AsyncStorage.setItem(
        "@user",
        JSON.stringify({ ...data, savedAt: Date.now() }),
      );
      if (data?.id) {
        Alert.alert(
          "Google user id",
          `Copy this id for seeding:\n\n${data.id}`,
          [{ text: "OK" }],
        );
      }
      setLoading(false);
      router.push("/role");
    } catch {
      setLoading(false);
      Alert.alert("Error", "Could not fetch your Google profile. Try again.", [
        { text: "OK" },
      ]);
    }
  }, [router]);

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.accessToken;
      if (token) {
        fetchUserInfo(token);
      } else {
        setLoading(false);
        Alert.alert("Sign-in Error", "No access token returned. Please try again.");
      }
    }
    if (response?.type === "error") {
      setLoading(false);
      Alert.alert("Sign-in Error", "Google sign-in failed. Please try again.");
    }
  }, [response, fetchUserInfo]);

  if (accessDenied) {
    return (
      <View style={styles.container}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="lock-closed-outline" size={40} color="#1a3a6b" />
        </View>
        <Text style={styles.errorTitle}>Access Restricted</Text>
        <Text style={styles.errorBody}>
          <Text style={styles.errorEmail}>{deniedEmail}</Text>
          {" "}is not an Augustana email.{"\n"}Please sign in with your{" "}
          <Text style={styles.errorHighlight}>@augustana.edu</Text> account.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setAccessDenied(false);
            setDeniedEmail("");
            setLoading(false);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Brand hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Ionicons name="car-sport" size={36} color="#ffffff" />
        </View>
        <Text style={styles.brand}>GusLift</Text>
        <Text style={styles.tagline}>Rides for Augustana, by Augustana</Text>
      </View>

      {/* Auth card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSubtitle}>
          Sign in with your Augustana Google account to continue.
        </Text>

        {isGoogleClientMissing && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color="#92400e" />
            <Text style={styles.warningText}>
              Google sign-in not configured for {platformName}. Set{" "}
              {expectedClientEnvVar} in .env and restart Expo.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={async () => {
            if (isGoogleClientMissing) {
              Alert.alert(
                "Configuration Error",
                `Missing ${expectedClientEnvVar} for ${platformName}.`,
              );
              return;
            }
            if (!request) {
              Alert.alert("Not Ready", "Auth request is still initializing. Please wait.");
              return;
            }
            try {
              setLoading(true);
              await promptAsync();
            } catch {
              setLoading(false);
              Alert.alert("Sign-in Error", "Could not start Google sign-in.");
            }
          }}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#1a3a6b" />
          ) : (
            <>
              <View style={styles.googleIconWrap}>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.badge}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#1a3a6b" />
          <Text style={styles.badgeText}>Restricted to @augustana.edu accounts</Text>
        </View>
      </View>
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
    gap: 24,
  },

  // Hero
  hero: {
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
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brand: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },

  // Auth card
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
    marginTop: -8,
  },

  // Warning
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 18,
  },

  // Google button
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f8faff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: -4,
  },
  badgeText: {
    fontSize: 12,
    color: "#64748b",
  },

  // Access denied
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  errorBody: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
  },
  errorEmail: {
    fontWeight: "600",
    color: "#0f172a",
  },
  errorHighlight: {
    fontWeight: "600",
    color: "#1a3a6b",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a3a6b",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
