/**
 * OAuth 2.0 redirect handler route.
 *
 * When Google completes the sign-in flow it redirects to:
 *   com.googleusercontent.apps.{clientId}:/oauth2redirect/google?code=...
 *
 * Android delivers this as a deep link, which expo-auth-session intercepts to
 * resolve the promptAsync() call in signup.js. However Expo Router ALSO receives
 * the same Linking event and — because it strips the scheme and routes by path —
 * tries to navigate to /oauth2redirect/google. Without this file that results in
 * the "Unmatched route" error screen.
 *
 * This route simply shows a loading spinner. The actual token exchange and
 * navigation to /role is handled asynchronously by the signup.js button handler,
 * which continues running in the background regardless of whether this screen is
 * visible. Once the exchange succeeds, router.push("/role") moves the user on.
 */

import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Ensures any still-open Custom Tab auth session is closed on web.
// No-op on Android native but harmless.
WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirectGoogle() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
});
