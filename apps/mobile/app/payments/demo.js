import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const DEMO_AMOUNT_CENTS = 500;

export default function PaymentsDemo() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    loadStripeConfig();
  }, []);

  async function loadUser() {
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setUser(parsed);
    } catch (_) {}
  }

  async function loadStripeConfig() {
    if (!BACKEND_URL) {
      setLoadingConfig(false);
      return;
    }

    setLoadingConfig(true);
    try {
      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const response = await fetch(`${normalizedBackendUrl}/api/payments/config`);
      const payload = await response.json();
      setConfig(payload);
    } catch (_) {
      setConfig({
        ready: false,
        error: "Could not reach the backend payments config route.",
      });
    } finally {
      setLoadingConfig(false);
    }
  }

  async function handleLaunchCheckout() {
    if (!BACKEND_URL) {
      Alert.alert(
        "Backend missing",
        "Set EXPO_PUBLIC_BACKEND_URL in apps/mobile/.env and restart Expo.",
      );
      return;
    }

    setLaunchError(null);
    setLaunching(true);
    let popup = null;

    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        popup = window.open("", "_blank");
        if (popup) {
          popup.document.write(
            "<!doctype html><title>Opening Stripe…</title><body style=\"font-family: system-ui; padding: 24px; color: #0f172a;\">Opening Stripe checkout…</body>",
          );
        }
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const response = await fetch(
        `${normalizedBackendUrl}/api/payments/checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: DEMO_AMOUNT_CENTS,
            rideLabel: "GusLift Sprint 2 Demo Ride",
            userId: user?.id || null,
            email: user?.email || null,
          }),
        },
      );

      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Failed to create Stripe session.");
      }

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          if (!popup) {
            window.location.assign(payload.url);
          } else {
            popup.location.href = payload.url;
          }
        }
      } else {
        await openBrowserAsync(payload.url, {
          presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
        });
      }
    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }
      const message =
        error instanceof Error ? error.message : "Unable to launch checkout.";
      setLaunchError(message);
      Alert.alert(
        "Stripe demo failed",
        message,
      );
    } finally {
      setLaunching(false);
    }
  }

  const isReady = Boolean(config?.ready);
  const amountLabel = `$${(DEMO_AMOUNT_CENTS / 100).toFixed(2)}`;

  return (
    <View style={styles.outer}>
      <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Stripe Demo Checkout</Text>
        <Text style={styles.subtitle}>
          This is a sprint demo flow using Stripe test mode and a hosted Checkout
          page.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Environment status</Text>
          {loadingConfig ? (
            <ActivityIndicator color="#1a3a6b" />
          ) : !BACKEND_URL ? (
            <Text style={styles.statusError}>
              Missing `EXPO_PUBLIC_BACKEND_URL` in the mobile env.
            </Text>
          ) : config?.error ? (
            <Text style={styles.statusError}>{config.error}</Text>
          ) : (
            <>
              <Text style={styles.statusLine}>
                Stripe configured: {isReady ? "Yes" : "No"}
              </Text>
              <Text style={styles.statusLine}>
                Mode: {config?.mode || "unknown"}
              </Text>
              <Text style={styles.statusLine}>
                Publishable key:{" "}
                {config?.publishableKeyConfigured ? "present" : "missing"}
              </Text>
              <Text style={styles.statusLine}>
                Secret key: {config?.secretKeyConfigured ? "present" : "missing"}
              </Text>
            </>
          )}
        </View>

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Demo purchase</Text>
          <Text style={styles.demoPrice}>{amountLabel}</Text>
          <Text style={styles.demoBody}>
            Charges a fixed sandbox amount for a fake GusLift ride payment. Stripe
            hosts the actual card form.
          </Text>
          {launchError ? (
            <Text style={styles.demoError}>{launchError}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!isReady || launching) && styles.primaryButtonDisabled,
            ]}
            onPress={handleLaunchCheckout}
            disabled={!isReady || launching}
            activeOpacity={0.85}
          >
            {launching ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Open Stripe Test Checkout</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suggested test card</Text>
          <Text style={styles.mono}>4242 4242 4242 4242</Text>
          <Text style={styles.helperText}>Use any future expiration date, any 3-digit CVC, and any ZIP code.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Demo notes</Text>
          <Text style={styles.helperText}>
            The success and cancel pages live in the backend app. After checkout,
            Stripe redirects there so the demo has a visible ending state.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 24,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#dbe4f0",
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 10,
  },
  statusLine: {
    fontSize: 15,
    color: "#374151",
    marginBottom: 6,
  },
  statusError: {
    fontSize: 15,
    color: "#b91c1c",
    lineHeight: 22,
  },
  demoCard: {
    backgroundColor: "#1a3a6b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  },
  demoTitle: {
    fontSize: 16,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  demoPrice: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  demoBody: {
    fontSize: 15,
    color: "#e5e7eb",
    lineHeight: 22,
    marginBottom: 18,
  },
  demoError: {
    fontSize: 14,
    lineHeight: 20,
    color: "#fde68a",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 10,
  },
  mono: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 1,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
  },
});
