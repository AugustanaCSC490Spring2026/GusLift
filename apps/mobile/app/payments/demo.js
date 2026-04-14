import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
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
const CHECKOUT_AMOUNT_CENTS = 500;

export default function PaymentsDemo() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [user, setUser] = useState(null);
  const rideId =
    typeof params.rideId === "string" && params.rideId.trim()
      ? params.rideId.trim()
      : null;
  const rideLabel =
    typeof params.rideLabel === "string" && params.rideLabel.trim()
      ? params.rideLabel.trim()
      : "GusLift Ride Payment";
  const paymentStage =
    typeof params.paymentStage === "string" && params.paymentStage.trim()
      ? params.paymentStage.trim()
      : "checkout";
  const returnPath =
    typeof params.returnPath === "string" && params.returnPath.trim()
      ? params.returnPath.trim()
      : null;

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
      let returnUrl = null;
      if (returnPath) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          returnUrl = new URL(returnPath, window.location.origin).toString();
        } else {
          const normalizedPath = returnPath.replace(/^\//, "");
          returnUrl = `guslift://${normalizedPath}`;
        }
      }
      const response = await fetch(
        `${normalizedBackendUrl}/api/payments/checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: CHECKOUT_AMOUNT_CENTS,
            rideLabel,
            rideId,
            returnUrl,
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
        "Checkout failed",
        message,
      );
    } finally {
      setLaunching(false);
    }
  }

  const isReady = Boolean(config?.ready);
  const amountLabel = `$${(CHECKOUT_AMOUNT_CENTS / 100).toFixed(2)}`;

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
        <Text style={styles.header}>Ride Checkout</Text>
        <Text style={styles.subtitle}>
          Complete payment to continue with your ride request.
        </Text>

        {loadingConfig ? (
          <View style={styles.statusCard}>
            <ActivityIndicator color="#1a3a6b" />
          </View>
        ) : !BACKEND_URL || config?.error || !isReady ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Checkout unavailable</Text>
            <Text style={styles.statusError}>
              {config?.error ||
                (!BACKEND_URL
                  ? "The backend payment service is not configured."
                  : "Payment configuration is incomplete.")}
            </Text>
          </View>
        ) : null}

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>
            {rideId
              ? "Ride payment"
              : paymentStage === "request"
                ? "Payment before matching"
                : "Checkout"}
          </Text>
          <Text style={styles.demoPrice}>{amountLabel}</Text>
          <Text style={styles.demoBody}>
            {rideId
              ? "This checkout will create or update a RidePayments record for the accepted ride before sending you back into GusLift."
              : paymentStage === "request"
                ? "This checkout happens immediately after the rider requests a ride. After payment, GusLift returns you to the waiting room to continue matching."
                : "Continue to Stripe to complete your ride payment."}
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
              <Text style={styles.primaryButtonText}>Continue to Checkout</Text>
            )}
          </TouchableOpacity>
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
  statusError: {
    fontSize: 15,
    color: "#4b5563",
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
});
