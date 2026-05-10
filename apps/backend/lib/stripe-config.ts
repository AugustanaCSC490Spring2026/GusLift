const STRIPE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";
const STRIPE_SECRET_KEY_ENV = "STRIPE_SECRET_KEY";

export type StripeMode = "test" | "live" | "unknown";

export type StripeConfigStatus = {
  provider: "stripe";
  ready: boolean;
  publishableKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  mode: StripeMode;
};

function readEnv(name: string) {
  const value = process.env[name];
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.includes("REPLACE_ME")) return null;
  return normalized;
}

function inferStripeMode(value: string | null): StripeMode {
  if (!value) return "unknown";
  if (value.startsWith("pk_test_") || value.startsWith("sk_test_")) {
    return "test";
  }
  if (value.startsWith("pk_live_") || value.startsWith("sk_live_")) {
    return "live";
  }
  return "unknown";
}

export function getStripePublishableKey() {
  return readEnv(STRIPE_PUBLISHABLE_KEY_ENV);
}

export function getStripeSecretKey() {
  return readEnv(STRIPE_SECRET_KEY_ENV);
}

export function getStripeConfigStatus(): StripeConfigStatus {
  const publishableKey = getStripePublishableKey();
  const secretKey = getStripeSecretKey();
  const publishableKeyConfigured = Boolean(publishableKey);
  const secretKeyConfigured = Boolean(secretKey);

  return {
    provider: "stripe",
    ready: publishableKeyConfigured && secretKeyConfigured,
    publishableKeyConfigured,
    secretKeyConfigured,
    mode:
      inferStripeMode(secretKey) !== "unknown"
        ? inferStripeMode(secretKey)
        : inferStripeMode(publishableKey),
  };
}

export function requireStripeConfig() {
  const publishableKey = getStripePublishableKey();
  const secretKey = getStripeSecretKey();

  if (!publishableKey || !secretKey) {
    throw new Error(
      `Missing Stripe environment variables: ${STRIPE_PUBLISHABLE_KEY_ENV} and/or ${STRIPE_SECRET_KEY_ENV}`,
    );
  }

  return { publishableKey, secretKey };
}
