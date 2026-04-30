import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

const OAUTH_FALLBACK_STORAGE_KEY = "GusLiftOAuthCallbackUrl";
const OAUTH_FALLBACK_MESSAGE_TYPE = "GusLiftOAuthCallback";

function completeAuthSession() {
  try {
    return WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
  } catch (error) {
    return {
      type: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Could not complete the sign-in redirect.",
    };
  }
}

function sendFallbackResultToOpener(result) {
  if (Platform.OS !== "web" || result?.type !== "failed") return;
  if (!result?.message?.includes("No auth session is currently in progress")) {
    return;
  }

  setTimeout(() => {
    const callbackUrl = window.location.href;
    window.localStorage.setItem(OAUTH_FALLBACK_STORAGE_KEY, callbackUrl);
    const message = { type: OAUTH_FALLBACK_MESSAGE_TYPE, url: callbackUrl };
    window.opener?.postMessage(
      message,
      window.location.origin,
    );
    const channel = new BroadcastChannel(OAUTH_FALLBACK_MESSAGE_TYPE);
    channel.postMessage(message);
    channel.close();
    window.close();
  }, 250);
}

export default function OAuthRedirect() {
  const result = useMemo(() => completeAuthSession(), []);
  const failed = result?.type === "failed";

  if (Platform.OS === "web" && result?.type === "success") {
    setTimeout(() => window.close(), 250);
  }

  useEffect(() => {
    sendFallbackResultToOpener(result);
  }, [result]);

  return (
    <View style={styles.container}>
      {failed ? null : <ActivityIndicator color="#3B82F6" />}
      <Text style={styles.text}>
        {failed ? "Could not finish sign in" : "Finishing sign in..."}
      </Text>
      {failed ? <Text style={styles.detail}>{result?.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  text: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },
  detail: {
    color: "#991B1B",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 320,
    paddingHorizontal: 16,
    textAlign: "center",
  },
});
