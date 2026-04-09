import AsyncStorage from "@react-native-async-storage/async-storage";
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

//Tech Tutorial Followed: https://www.youtube.com/watch?v=BDeKTPQzvR4&t=584s
//Got help from Claude to handle errors properly for redirects and to check for stored user session on app load.

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";

export default function Signup() {
  const router = useRouter();
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
          // eslint-disable-next-line no-console
          console.log("[GusLift] Existing Google user id (from storage):", parsed.id);
        }

        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - parsed.savedAt > sevenDays;
        if (!isExpired) {
          if (!parsed.role) {
            router.push("/role");
            return;
          }

          // Always send returning users to the home screen.
          // From there they can choose driver/rider flows,
          // and we can show setup prompts without hard-locking navigation.
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
      // Log the Google user id immediately on successful sign-in.
      if (data?.id) {
        // eslint-disable-next-line no-console
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

      await AsyncStorage.setItem(
        "@user",
        JSON.stringify({ ...data, savedAt: Date.now() }),
      );

      // Surface the id once to make it very easy to copy.
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
  }, [router, enforceSchoolEmail]);

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.accessToken;
      if (token) {
        fetchUserInfo(token);
      } else {
        setLoading(false);
        Alert.alert(
          "Sign-in Error",
          "No access token returned. Please try again.",
        );
      }
    }
    if (response?.type === "error") {
      setLoading(false);
      Alert.alert("Sign-in Error", "Google sign-in failed. Please try again.");
    }
  }, [response, fetchUserInfo]);

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
            await promptAsync();
          } catch {
            setLoading(false);
            Alert.alert("Sign-in Error", "Could not start Google sign-in.");
          }
        }}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
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
  buttonDisabled: { opacity: 0.5 },
  errorText: {
    color: "#991b1b",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
