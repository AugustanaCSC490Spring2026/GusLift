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
  const checkoutTitle = rideId
    ? "Ride payment"
    : paymentStage === "request"
      ? "Payment before matching"
      : "Checkout";
  const checkoutDescription = rideId
    ? "This checkout will create or update a RidePayments record for the accepted ride before sending you back into GusLift."
    : paymentStage === "request"
      ? "This checkout happens immediately after the rider requests a ride. After payment, GusLift returns you to the waiting room to continue matching."
      : "Continue to Stripe to complete your ride payment.";

  return (
    <View style={styles.outer}>
      <View style={styles.bgOrbLarge} />
      <View style={styles.bgOrbSmall} />

      <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.eyebrow}>Secure checkout</Text>
          <Text style={styles.header}>Ride Checkout</Text>
          <Text style={styles.subtitle}>
            Complete payment to continue with your ride request.
          </Text>
        </View>

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
          <View style={styles.cardGlow} />
          <View style={styles.cardTopRow}>
            <View style={styles.cardHeadingGroup}>
              <Text style={styles.demoTitle}>{checkoutTitle}</Text>
              <Text style={styles.cardMicrocopy}>Powered by Stripe</Text>
            </View>
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>
                {rideId ? "Ride linked" : "Ready"}
              </Text>
            </View>
          </View>
          <Text style={styles.demoPrice}>{amountLabel}</Text>
          <Text style={styles.demoBody}>{checkoutDescription}</Text>

          <View style={styles.metaStrip}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Payment</Text>
              <Text style={styles.metaValue}>Card checkout</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Return</Text>
              <Text style={styles.metaValue}>Back to GusLift</Text>
            </View>
          </View>

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
    backgroundColor: "#f4efe5",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  bgOrbLarge: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(212, 170, 90, 0.18)",
  },
  bgOrbSmall: {
    position: "absolute",
    top: 140,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(26, 58, 107, 0.08)",
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
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  heroBlock: {
    marginBottom: 24,
  },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: "#eadfc6",
    color: "#8b5e1a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  header: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#5f6675",
    lineHeight: 24,
    maxWidth: 520,
  },
  statusCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#d9dfeb",
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
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#16345f",
    borderRadius: 26,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#102746",
    shadowOpacity: 0.24,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6,
  },
  cardGlow: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  cardHeadingGroup: {
    flex: 1,
  },
  demoTitle: {
    fontSize: 16,
    color: "#d8e4f2",
    marginBottom: 4,
    fontWeight: "700",
  },
  cardMicrocopy: {
    fontSize: 13,
    color: "#9eb6d3",
  },
  stagePill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  stagePillText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  demoPrice: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 10,
  },
  demoBody: {
    fontSize: 15,
    color: "#d8e4f2",
    lineHeight: 23,
    marginBottom: 20,
  },
  metaStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  metaBlock: {
    flex: 1,
  },
  metaDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 12,
  },
  metaLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#9eb6d3",
    marginBottom: 4,
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "700",
  },
  demoError: {
    fontSize: 14,
    lineHeight: 20,
    color: "#fde68a",
    marginBottom: 14,
    backgroundColor: "rgba(127, 29, 29, 0.35)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: "#d7a24a",
    borderRadius: 14,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#132642",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
