import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { registerCurrentUserPushToken } from "../lib/pushNotifications";

WebBrowser.maybeCompleteAuthSession();
const SCHOOL_DOMAIN = "augustana.edu";

const C = {
  brand: "#3B82F6",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3c-.4.4 6.6-4.8 6.6-15 0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

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

  // ── Animations ────────────────────────────────────────────
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlideY  = useRef(new Animated.Value(20)).current;
  const floatY      = useRef(new Animated.Value(0)).current;
  const auraOpacity = useRef(new Animated.Value(0.18)).current;
  const shineX      = useRef(new Animated.Value(-150)).current;
  const blob1Y      = useRef(new Animated.Value(0)).current;
  const blob2Y      = useRef(new Animated.Value(0)).current;
  const blob3X      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardSlideY,  { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Button float bob
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -6, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(floatY, { toValue:  0, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    floatLoop.start();

    // Aura pulse
    const auraLoop = Animated.loop(Animated.sequence([
      Animated.timing(auraOpacity, { toValue: 0.38, duration: 1500, useNativeDriver: true }),
      Animated.timing(auraOpacity, { toValue: 0.18, duration: 1500, useNativeDriver: true }),
    ]));
    auraLoop.start();

    // Shine sweep — recursive so the delay resets each cycle
    const runShine = () => {
      shineX.setValue(-150);
      Animated.sequence([
        Animated.delay(5500),
        Animated.timing(shineX, { toValue: 500, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) runShine(); });
    };
    runShine();

    // Blob drifts
    const blob1Loop = Animated.loop(Animated.sequence([
      Animated.timing(blob1Y, { toValue: -30, duration: 9000,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(blob1Y, { toValue:   0, duration: 9000,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const blob2Loop = Animated.loop(Animated.sequence([
      Animated.timing(blob2Y, { toValue:  40, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(blob2Y, { toValue:   0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const blob3Loop = Animated.loop(Animated.sequence([
      Animated.timing(blob3X, { toValue:  30, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(blob3X, { toValue:   0, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    blob1Loop.start();
    blob2Loop.start();
    blob3Loop.start();

    return () => {
      floatLoop.stop();
      auraLoop.stop();
      blob1Loop.stop();
      blob2Loop.stop();
      blob3Loop.stop();
      shineX.stopAnimation();
    };
  }, []);

  // ── Auth logic (unchanged) ────────────────────────────────
  const checkStoredUser = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        let parsed;
        try { parsed = JSON.parse(stored); }
        catch { await AsyncStorage.removeItem("@user"); return; }

        if (parsed?.id) console.log("[GusLift] Existing Google user id:", parsed.id);

        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt > sevenDays) {
          await AsyncStorage.removeItem("@user");
          return;
        }
        if (!parsed.role) { router.push("/role"); return; }
        if (parsed.role === "driver") {
          parsed.driverSetupComplete ? router.replace("/driver/DriverHome") : router.replace("/driver/DriverSetup");
        } else {
          parsed.riderSetupComplete ? router.replace("/rider/RiderHome") : router.replace("/rider/RiderSetup");
        }
      }
    } catch { /* no stored session */ }
  }, [router]);

  useEffect(() => { checkStoredUser(); }, [checkStoredUser]);

  const fetchUserInfo = useCallback(async (token) => {
    try {
      const res  = await fetch("https://www.googleapis.com/userinfo/v2/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const email = (data?.email || "").toLowerCase();
      if (data?.id) console.log("[GusLift] Sign-in user id:", data.id);

      if (enforceSchoolEmail && !email.endsWith(`@${SCHOOL_DOMAIN}`)) {
        setLoading(false);
        Alert.alert("School Email Required", `Please sign in with your @${SCHOOL_DOMAIN} email.`);
        return;
      }

      if (presetRole === "rider" || presetRole === "driver") {
        await AsyncStorage.setItem("@user", JSON.stringify({ ...data, savedAt: Date.now(), role: presetRole }));
      } else {
        await AsyncStorage.setItem("@user", JSON.stringify({ ...data, savedAt: Date.now() }));
      }
      void registerCurrentUserPushToken();
      setLoading(false);

      if (presetRole === "rider") {
        const riderParams = {};
        if (landingPickup)      riderParams.pickup      = landingPickup;
        if (landingDestination) riderParams.destination = landingDestination;
        router.push({ pathname: "/rider/RiderSetup", params: riderParams });
      } else if (presetRole === "driver") {
        router.push("/driver/DriverSetup");
      } else {
        router.push("/role");
      }
    } catch {
      setLoading(false);
      Alert.alert("Error", "Could not fetch your Google profile. Try again.", [{ text: "OK" }]);
    }
  }, [router, enforceSchoolEmail, presetRole, landingPickup, landingDestination]);

  useEffect(() => {
    console.log("[GusLift] Auth response type:", response?.type ?? "none");
    if (response?.params)  console.log("[GusLift] Auth response params:", JSON.stringify(response.params));
    if (response?.error)   console.log("[GusLift] Auth response error:",  JSON.stringify(response.error));
    if (response?.url)     console.log("[GusLift] Auth response url:",     response.url);

    if (response?.type === "success") {
      if (!loading || handledAuthAttemptRef.current > 0) return;
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

  const handlePress = async () => {
    if (isGoogleClientMissing) {
      Alert.alert("Configuration Error", `Missing ${expectedClientEnvVar} for ${platformName}. Add it in apps/mobile/.env and restart Expo with --clear.`);
      return;
    }
    if (!request) {
      Alert.alert("Google Sign-In Not Ready", "Auth request is still initializing. If this keeps happening, restart Expo with --clear and verify your Google OAuth redirect settings.");
      return;
    }
    try {
      handledAuthAttemptRef.current = 0;
      setLoading(true);
      console.log("[GusLift] redirectUri:", redirectUri);
      console.log("[GusLift] request.redirectUri:", request?.redirectUri);
      const authResult = await promptAsync();
      console.log("[GusLift] promptAsync result type:", authResult?.type ?? "none");
      if (authResult?.params) console.log("[GusLift] promptAsync params:", JSON.stringify(authResult.params));
      if (authResult?.error)  console.log("[GusLift] promptAsync error:",  JSON.stringify(authResult.error));
      if (authResult?.url)    console.log("[GusLift] promptAsync url:",     authResult.url);

      if (authResult?.type === "success") {
        if (handledAuthAttemptRef.current > 0) return;
        const token = authResult.authentication?.accessToken;
        if (token) {
          handledAuthAttemptRef.current = 1;
          fetchUserInfo(token);
        } else if (authResult.params?.code) {
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

            if (tokenData.access_token) {
              fetchUserInfo(tokenData.access_token);
            } else {
              setLoading(false);
              Alert.alert(
                "Sign-in Error",
                `Token exchange failed: ${tokenData.error_description ?? tokenData.error ?? "unknown"}`,
              );
            }
          } catch {
            setLoading(false);
            Alert.alert("Sign-in Error", "Token exchange failed. Please try again.");
          }
        } else {
          handledAuthAttemptRef.current = 1;
          setLoading(false);
          Alert.alert("Sign-in Error", "No access token returned. Please try again.");
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
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Background blobs */}
      <Animated.View style={[styles.blob, styles.blob1, { transform: [{ translateY: blob1Y }] }]} />
      <Animated.View style={[styles.blob, styles.blob2, { transform: [{ translateY: blob2Y }] }]} />
      <Animated.View style={[styles.blob, styles.blob3, { transform: [{ translateX: blob3X }] }]} />

      {/* Card */}
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardSlideY }] }]}>

        {/* "Welcome to GusLift" */}
        <View style={styles.headerGroup}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.logoText}>
            <Text style={styles.gus}>Gus</Text>Lift
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Sign in with your School's Google Account to get started.
        </Text>

        {isGoogleClientMissing && (
          <Text style={styles.errorText}>
            Google sign-in is not configured for {platformName}. Set {expectedClientEnvVar} in apps/mobile/.env and restart Expo.
          </Text>
        )}

        {/* Button stage */}
        <View style={styles.btnStage}>
          {/* Pulsing aura behind button */}
          <Animated.View style={[styles.aura, { opacity: auraOpacity }]} />

          {/* Floating button */}
          <Animated.View style={{ transform: [{ translateY: floatY }] }}>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnLoading]}
              onPress={handlePress}
              disabled={loading}
              activeOpacity={0.88}
            >
              {/* Shine sweep */}
              <Animated.View
                style={[styles.shine, { transform: [{ translateX: shineX }] }]}
                pointerEvents="none"
              />
              {loading ? (
                <ActivityIndicator color={C.muted} size="small" />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.btnLabel}>Sign in with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Ellipse shadow below button */}
          <Animated.View style={[styles.shadowPad, { opacity: auraOpacity }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    overflow: "hidden",
  },

  // ── Blobs ──
  blob: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.45,
  },
  blob1: {
    width: 360,
    height: 360,
    backgroundColor: "rgba(59,130,246,0.35)",
    top: -80,
    left: -80,
  },
  blob2: {
    width: 420,
    height: 420,
    backgroundColor: "rgba(59,130,246,0.18)",
    bottom: -120,
    right: -100,
  },
  blob3: {
    width: 280,
    height: 280,
    backgroundColor: "rgba(99,102,241,0.18)",
    top: "40%",
    left: "60%",
  },

  // ── Card ──
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: C.card,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 32,
    paddingVertical: 56,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Header ──
  headerGroup: {
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 44,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -1.6,
    lineHeight: 48,
    textAlign: "center",
  },
  logoText: {
    fontSize: 44,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -1.6,
    lineHeight: 48,
    textAlign: "center",
  },
  gus: {
    color: C.brand,
  },

  subtitle: {
    fontSize: 15,
    color: C.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 280,
  },

  errorText: {
    color: "#991b1b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },

  // ── Button stage ──
  btnStage: {
    width: "100%",
    alignItems: "center",
    paddingTop: 8,
  },
  aura: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    height: 54,
    borderRadius: 12,
    backgroundColor: C.brand,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 54,
    width: 320,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  btnLoading: {
    opacity: 0.7,
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  shadowPad: {
    marginTop: 10,
    width: "70%",
    height: 14,
    borderRadius: 9999,
    backgroundColor: C.brand,
    opacity: 0.15,
  },
});
