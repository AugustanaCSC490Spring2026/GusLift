import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    redirectUri: makeRedirectUri({
      scheme: "guslift",
      useProxy: true,
    }),
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      fetchUserInfo(authentication.accessToken);
    }

    if (response?.type === "error") {
      Alert.alert("Sign-in Error", "Something went wrong. Please try again.");
    }
  }, [response]);

  async function fetchUserInfo(token) {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();

      // ✅ Augustana email check
      if (!user.email.endsWith("@augustana.edu")) {
        Alert.alert(
          "Access Denied",
          "You must sign in with an @augustana.edu email address.",
          [{ text: "OK" }]
        );
        return;
      }

      // ✅ Allowed — go to home screen
      router.replace('/tabs)');
    } catch (err) {
      Alert.alert("Error", "Could not fetch your account info. Try again.");
      console.error(err);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GusLift 🏋️</Text>
      <Text style={styles.subtitle}>Sign in with your Augustana account</Text>

      <TouchableOpacity
        style={[styles.button, !request && styles.buttonDisabled]}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>@augustana.edu emails only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 48,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#aaa",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    marginTop: 16,
    color: "#999",
    fontSize: 13,
  },
});