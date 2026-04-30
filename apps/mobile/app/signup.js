import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams, useRouter } from "expo-router";
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

//Tech Tutorial Followed: https://www.youtube.com/watch?v=BDeKTPQzvR4&t=584s
//Got help from Claude to handle errors properly for redirects and to check for stored user session on app load.

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";
const OAUTH_FALLBACK_STORAGE_KEY = "GusLiftOAuthCallbackUrl";
const OAUTH_FALLBACK_MESSAGE_TYPE = "GusLiftOAuthCallback";

function getAccessTokenFromCallbackUrl(callbackUrl) {
  if (!callbackUrl) return null;
  try {
    const url = new URL(callbackUrl);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    return (
      hashParams.get("access_token") ||
      url.searchParams.get("access_token") ||
      null
    );
  } catch {
    return null;
  }
}

export default function Signup() {
  const router = useRouter();
  const { role: presetRole, pickup: landingPickup, destination: landingDestination } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const enforceSchoolEmail =
    process.env.EXPO_PUBLIC_ENFORCE_SCHOOL_EMAIL !== "false";

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const webRedirectUriOverride =
    process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI_WEB;
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
    ...(enforceSchoolEmail ? { extraParams: { hd: SCHOOL_DOMAIN } } : {}),
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

        // Log any previously saved Google user id so engineers can grab it.
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

          if (parsed.role === "driver") {
            if (parsed.driverSetupComplete) {
              router.replace("/driver/DriverHome");
            } else {
              router.replace("/driver/DriverSetup");
            }
          } else {
            if (parsed.riderSetupComplete) {
              router.replace("/rider/RiderHome");
            } else {
              router.replace("/rider/RiderSetup");
            }
          }
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
      // Log the Google user id immediately on successful sign-in.
      if (data?.id) {
        console.log("[GusLift] Sign-in user id:", data.id);
      }

      if (enforceSchoolEmail && !email.endsWith(`@${SCHOOL_DOMAIN}`)) {
        setLoading(false);
        Alert.alert(
          "School Email Required",
          `Please sign in with your @${SCHOOL_DOMAIN} email.`,
        );
        return;
      }

      // If a role was passed from the landing page, auto-assign and skip role selection
      if (presetRole === "rider" || presetRole === "driver") {
        const userData = { ...data, savedAt: Date.now(), role: presetRole };
        await AsyncStorage.setItem("@user", JSON.stringify(userData));
      } else {
        await AsyncStorage.setItem(
          "@user",
          JSON.stringify({ ...data, savedAt: Date.now() }),
        );
      }

      setLoading(false);

      // Route based on pre-set role or go to role selection
      if (presetRole === "rider") {
        // Forward landing page params through RiderSetup → RequestRide
        const riderParams = {};
        if (landingPickup) riderParams.pickup = landingPickup;
        if (landingDestination) riderParams.destination = landingDestination;
        router.push({ pathname: "/rider/RiderSetup", params: riderParams });
      } else if (presetRole === "driver") {
        router.push("/driver/DriverSetup");
      } else {
        router.push("/role");
      }
    } catch {
      setLoading(false);
      Alert.alert("Error", "Could not fetch your Google profile. Try again.", [
        { text: "OK" },
      ]);
    }
  }, [router, enforceSchoolEmail, presetRole, landingPickup, landingDestination]);

  const handleAuthResponse = useCallback((authResponse) => {
    if (authResponse?.type === "success") {
      const token = authResponse.authentication?.accessToken;
      if (token) {
        fetchUserInfo(token);
      } else {
        setLoading(false);
        Alert.alert(
          "Sign-in Error",
          "No access token returned. Please try again.",
        );
      }
      return;
    }
    if (authResponse?.type === "error") {
      setLoading(false);
      Alert.alert("Sign-in Error", "Google sign-in failed. Please try again.");
    }
    if (authResponse?.type === "dismiss" || authResponse?.type === "cancel") {
      setLoading(false);
    }
  }, [fetchUserInfo]);

  useEffect(() => {
    handleAuthResponse(response);
  }, [response, handleAuthResponse]);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;

    async function handleFallbackCallbackUrl(callbackUrl) {
      const token = getAccessTokenFromCallbackUrl(callbackUrl);
      if (!token) return;
      window.localStorage.removeItem(OAUTH_FALLBACK_STORAGE_KEY);
      setLoading(true);
      await fetchUserInfo(token);
    }

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OAUTH_FALLBACK_MESSAGE_TYPE) return;
      handleFallbackCallbackUrl(event.data.url);
    }

    function handleStorage(event) {
      if (event.key !== OAUTH_FALLBACK_STORAGE_KEY || !event.newValue) return;
      handleFallbackCallbackUrl(event.newValue);
    }

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    const channel = new BroadcastChannel(OAUTH_FALLBACK_MESSAGE_TYPE);
    channel.onmessage = (event) => {
      if (event.data?.type !== OAUTH_FALLBACK_MESSAGE_TYPE) return;
      handleFallbackCallbackUrl(event.data.url);
    };

    const storedCallbackUrl = window.localStorage.getItem(
      OAUTH_FALLBACK_STORAGE_KEY,
    );
    if (storedCallbackUrl) {
      handleFallbackCallbackUrl(storedCallbackUrl);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      channel.close();
    };
  }, [fetchUserInfo]);

  // Sign up screen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <Text style={styles.subtitle}>
        {enforceSchoolEmail
          ? "Sign in with your Augustana Google account."
          : "Sign in with your Google account."}
      </Text>
      {isGoogleClientMissing ? (
        <Text style={styles.errorText}>
          Google sign-in is not configured for {platformName}. Set{" "}
          {expectedClientEnvVar} in apps/mobile/.env and restart Expo.
        </Text>
      ) : !request ? (
        <Text style={styles.errorText}>
          Preparing Google sign-in request...
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={async () => {
          if (isGoogleClientMissing) {
            Alert.alert(
              "Configuration Error",
              `Missing ${expectedClientEnvVar} for ${platformName}. Add it in apps/mobile/.env and restart Expo with --clear.`,
            );
            return;
          }

          if (!request) {
            Alert.alert(
              "Google Sign-In Not Ready",
              "Auth request is still initializing. If this keeps happening, restart Expo with --clear and verify your Google OAuth redirect settings.",
            );
            return;
          }

          try {
            setLoading(true);
            if (Platform.OS === "web") {
              window.localStorage.removeItem(OAUTH_FALLBACK_STORAGE_KEY);
            }
            const authResponse = await promptAsync();
            handleAuthResponse(authResponse);
          } catch {
            setLoading(false);
            Alert.alert("Sign-in Error", "Could not start Google sign-in.");
          }
        }}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonDisabled: { opacity: 0.5 },
  errorText: {
    color: "#991b1b",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
