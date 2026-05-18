import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BACKEND_URL = process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

function normalizeUrl(base) {
  return base?.replace(/\/$/, "") ?? "";
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldInput({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function PayoutSettings() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [venmo, setVenmo] = useState("");
  const [cashapp, setCashapp] = useState("");
  const [zelle, setZelle] = useState("");
  const [acceptsCash, setAcceptsCash] = useState(true);

  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("@user");
        if (!stored) return;
        const user = JSON.parse(stored);
        setUserId(user.id);
        await loadSettings(user.id);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadSettings(uid) {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${normalizeUrl(BACKEND_URL)}/api/driver/payment-settings?user_id=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const { settings } = await res.json();
      if (!settings) return;
      setVenmo(settings.venmo_username ?? "");
      setCashapp(settings.cashapp_username ?? "");
      setZelle(settings.zelle_contact ?? "");
      setAcceptsCash(settings.accepts_cash ?? true);
      setStripeOnboarded(settings.stripe_onboarded ?? false);
    } catch (_) {}
  }

  async function checkStripeStatus() {
    if (!BACKEND_URL || !userId) return;
    try {
      const res = await fetch(`${normalizeUrl(BACKEND_URL)}/api/driver/stripe/status`, {
        headers: { "x-user-id": userId },
      });
      if (!res.ok) return;
      const payload = await res.json();
      if (payload.onboarded) setStripeOnboarded(true);
    } catch (_) {}
  }

  async function handleConnectStripe() {
    if (!BACKEND_URL || !userId) {
      Alert.alert("Setup required", "Backend URL is not configured.");
      return;
    }
    setStripeConnecting(true);
    try {
      const res = await fetch(`${normalizeUrl(BACKEND_URL)}/api/driver/stripe/connect`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      const payload = await res.json();
      if (!res.ok || !payload.url) {
        Alert.alert("Stripe error", payload.error ?? "Could not start onboarding.");
        return;
      }
      if (Platform.OS === "web") {
        window.open(payload.url, "_blank");
      } else {
        await openBrowserAsync(payload.url);
        await checkStripeStatus();
      }
    } catch (err) {
      Alert.alert("Error", err.message ?? "Could not connect to Stripe.");
    } finally {
      setStripeConnecting(false);
    }
  }

  async function handleSave() {
    if (!BACKEND_URL || !userId) {
      Alert.alert("Setup required", "Backend URL is not configured.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        venmo_username: venmo.trim() || null,
        cashapp_username: cashapp.trim() || null,
        zelle_contact: zelle.trim() || null,
        accepts_cash: acceptsCash,
      };

      const order = [];
      if (stripeOnboarded) order.push("stripe");
      if (body.venmo_username) order.push("venmo");
      if (body.cashapp_username) order.push("cashapp");
      if (body.zelle_contact) order.push("zelle");
      if (body.accepts_cash) order.push("cash");
      if (order.length === 0) order.push("cash");
      body.preferred_order = order;

      const res = await fetch(`${normalizeUrl(BACKEND_URL)}/api/driver/payment-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Save failed", err.error ?? "Please try again.");
        return;
      }
      Alert.alert("Saved", "Your payout preferences have been saved.");
    } catch (err) {
      Alert.alert("Error", err.message ?? "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Payout Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Choose how riders can pay you. All methods are optional — riders will see the ones you enable.
        </Text>

        {/* Stripe */}
        <Section title="Stripe (bank payout)">
          <Text style={styles.methodDesc}>
            Receive card payments directly to your bank account. Requires identity verification (18+).
          </Text>
          {stripeOnboarded ? (
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedBadgeText}>Connected</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.stripeButton, stripeConnecting && { opacity: 0.6 }]}
              onPress={handleConnectStripe}
              disabled={stripeConnecting}
              activeOpacity={0.85}
            >
              {stripeConnecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.stripeButtonText}>Connect bank account</Text>
              )}
            </TouchableOpacity>
          )}
        </Section>

        {/* Venmo */}
        <Section title="Venmo">
          <Text style={styles.methodDesc}>Riders will see your username and send payment before getting in.</Text>
          <FieldInput
            label="Username"
            value={venmo}
            onChangeText={setVenmo}
            placeholder="@yourname"
          />
        </Section>

        {/* Cash App */}
        <Section title="Cash App">
          <Text style={styles.methodDesc}>Riders will see your Cash App username to send payment.</Text>
          <FieldInput
            label="$Cashtag"
            value={cashapp}
            onChangeText={setCashapp}
            placeholder="$yourcashtag"
          />
        </Section>

        {/* Zelle */}
        <Section title="Zelle">
          <Text style={styles.methodDesc}>Share your phone number or email for Zelle transfers.</Text>
          <FieldInput
            label="Phone / Email"
            value={zelle}
            onChangeText={setZelle}
            placeholder="555-123-4567 or you@example.com"
            keyboardType="email-address"
          />
        </Section>

        {/* Cash */}
        <Section title="Cash">
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Accept cash in person</Text>
              <Text style={styles.methodDesc}>Rider pays you directly when they get in the car.</Text>
            </View>
            <Switch
              value={acceptsCash}
              onValueChange={setAcceptsCash}
              trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save preferences</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 16,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    marginBottom: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  methodDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#94A3B8",
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stripeButton: {
    backgroundColor: "#635BFF",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stripeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  connectedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  connectedBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
