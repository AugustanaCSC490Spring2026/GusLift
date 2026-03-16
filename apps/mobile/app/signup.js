import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

//Tech Tutorial Followed: https://www.youtube.com/watch?v=BDeKTPQzvR4&t=584s
//Got help from Claude to handle errors properly for redirects and to check for stored user session on app load.

WebBrowser.maybeCompleteAuthSession();

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState("");

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    redirectUri: makeRedirectUri({ scheme: "guslift" }),
  });

  useEffect(() => {
    checkStoredUser();
  }, []);

  async function checkStoredUser() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (stored) {
        const parsed = JSON.parse(stored);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - parsed.savedAt > sevenDays;
        if (!isExpired) {
          router.replace("/home");
        } else {
          await AsyncStorage.removeItem("@user");
        }
      }
    } catch {
      // No stored session
    }
  }

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
  }, [response]);

  async function fetchUserInfo(token) {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const email = (data?.email || "").toLowerCase();

      if (!email.endsWith("@augustana.edu")) {
        setLoading(false);
        setDeniedEmail(data.email);
        setAccessDenied(true);
        return;
      }

      console.log("Google user signed in:", data?.id);

      await AsyncStorage.setItem(
        "@user",
        JSON.stringify({ ...data, savedAt: Date.now() })
      );

      setLoading(false);
      router.replace("/home");
    } catch {
      setLoading(false);
      Alert.alert("Error", "Could not fetch your Google profile. Try again.", [{ text: "OK" }]);
    }
  }

  // Wrong email screen
  if (accessDenied) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sorry!</Text>
        <Text style={styles.subtitle}>
          {deniedEmail} is not associated with @augustana.edu.{"\n\n"}
          Please sign in with your Augie email.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setAccessDenied(false);
            setDeniedEmail("");
            setLoading(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Try Again with Augie Email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Sign up screen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <Text style={styles.subtitle}>Sign in with your Augustana Google account.</Text>
      <TouchableOpacity
        style={[styles.button, (!request || loading) && styles.buttonDisabled]}
        onPress={() => {
          setLoading(true);
          promptAsync();
        }}
        disabled={!request || loading}
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
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
