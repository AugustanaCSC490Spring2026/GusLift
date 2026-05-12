import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { registerCurrentUserPushToken } from "../lib/pushNotifications";

//Tech Tutorial Followed: https://www.youtube.com/watch?v=BDeKTPQzvR4&t=584s
//Got help from Claude to handle errors properly for redirects and to check for stored user session on app load.

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";

export default function Signup() {
  const router = useRouter();
  const { role: presetRole, pickup: landingPickup, destination: landingDestination } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const handledAuthAttemptRef = useRef(0);
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
  // On Android, Google's OAuth server only accepts the reverse-client-ID scheme
  // when "Enable custom URI scheme" is turned on in Cloud Console, i.e.:
  //   com.googleusercontent.apps.{clientId}:/oauth2redirect/google
  // That scheme is already registered in AndroidManifest.xml (added via app.json),
  // so Android can route the callback correctly.
  //
  // expo-auth-session would otherwise auto-compute:
  //   com.guslift.app:/oauthredirect  (Application.applicationId)
  // which is NOT a registered scheme → Android can't open it → "dismiss".
  const androidReverseClientId = androidClientId
    ? androidClientId.split(".").reverse().join(".")
    : null;
  const fallbackRedirectUri =
    Platform.OS === "android" && androidReverseClientId
      ? `${androidReverseClientId}:/oauth2redirect/google`
      : makeRedirectUri({
          scheme: "guslift",
          path: "oauthredirect",
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
    redirectUri, // always explicit – avoids the com.guslift.app scheme auto-inference
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
      void registerCurrentUserPushToken();

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

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[GusLift] Auth response type:", response?.type ?? "none");
    if (response?.params) {
      // eslint-disable-next-line no-console
      console.log("[GusLift] Auth response params:", JSON.stringify(response.params));
    }
    if (response?.error) {
      // eslint-disable-next-line no-console
      console.log("[GusLift] Auth response error:", JSON.stringify(response.error));
    }
    if (response?.url) {
      // eslint-disable-next-line no-console
      console.log("[GusLift] Auth response url:", response.url);
    }
    if (response?.type === "success") {
      if (!loading) {
        return;
      }
      if (handledAuthAttemptRef.current > 0) {
        return;
      }
      handledAuthAttemptRef.current = 1;
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
      return;
    }
    if (response?.type === "error") {
      handledAuthAttemptRef.current = 1;
      setLoading(false);
      Alert.alert("Sign-in Error", "Google sign-in failed. Please try again.");
      return;
    }
    if (response && response.type !== "success") {
      handledAuthAttemptRef.current = 1;
      // Android can return dismiss/cancel; always clear spinner in those cases.
      setLoading(false);
    }
  }, [response, fetchUserInfo, loading]);

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
            handledAuthAttemptRef.current = 0;
            setLoading(true);
            // eslint-disable-next-line no-console
            console.log("[GusLift] redirectUri:", redirectUri);
            // eslint-disable-next-line no-console
            console.log("[GusLift] request.redirectUri:", request?.redirectUri);
            const authResult = await promptAsync();
            // eslint-disable-next-line no-console
            console.log("[GusLift] promptAsync result type:", authResult?.type ?? "none");
            if (authResult?.params) {
              // eslint-disable-next-line no-console
              console.log("[GusLift] promptAsync params:", JSON.stringify(authResult.params));
            }
            if (authResult?.error) {
              // eslint-disable-next-line no-console
              console.log("[GusLift] promptAsync error:", JSON.stringify(authResult.error));
            }
            if (authResult?.url) {
              // eslint-disable-next-line no-console
              console.log("[GusLift] promptAsync url:", authResult.url);
            }

            // Use prompt result directly as a fallback in case response state lags.
            if (authResult?.type === "success") {
              if (handledAuthAttemptRef.current > 0) {
                return;
              }
              const token = authResult.authentication?.accessToken;
              if (token) {
                // Implicit / token flow: access token came back immediately.
                handledAuthAttemptRef.current = 1;
                fetchUserInfo(token);
              } else if (authResult.params?.code) {
                // PKCE authorization-code flow.
                // expo-auth-session's auto-exchange has no error handler so it
                // can fail silently (response state never updates).
                // Exchange the code manually so we can log failures and
                // handle the access token directly.
                handledAuthAttemptRef.current = 1;
                try {
                  const body = Object.entries({
                    code: authResult.params.code,
                    client_id: androidClientId,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code",
                    code_verifier: request?.codeVerifier ?? "",
                  })
                    .map(
                      ([k, v]) =>
                        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
                    )
                    .join("&");

                  const tokenRes = await fetch(
                    "https://oauth2.googleapis.com/token",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                      },
                      body,
                    },
                  );
                  const tokenData = await tokenRes.json();
                  // eslint-disable-next-line no-console
                  console.log(
                    "[GusLift] Token exchange status:",
                    tokenRes.status,
                    tokenData.error ?? "ok",
                  );

                  if (tokenData.access_token) {
                    fetchUserInfo(tokenData.access_token);
                  } else {
                    setLoading(false);
                    Alert.alert(
                      "Sign-in Error",
                      `Token exchange failed: ${tokenData.error_description ?? tokenData.error ?? "unknown"}`,
                    );
                  }
                } catch (exchangeErr) {
                  // eslint-disable-next-line no-console
                  console.log(
                    "[GusLift] Token exchange exception:",
                    exchangeErr?.message,
                  );
                  setLoading(false);
                  Alert.alert(
                    "Sign-in Error",
                    "Token exchange failed. Please try again.",
                  );
                }
              } else {
                handledAuthAttemptRef.current = 1;
                setLoading(false);
                Alert.alert(
                  "Sign-in Error",
                  "No access token returned. Please try again.",
                );
              }
            } else if (authResult && authResult.type !== "opened") {
              handledAuthAttemptRef.current = 1;
              setLoading(false);
            }
          } catch {
            handledAuthAttemptRef.current = 1;
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
