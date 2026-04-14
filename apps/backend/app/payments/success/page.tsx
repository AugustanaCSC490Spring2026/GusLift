import { formatAmount, retrieveCheckoutSession } from "@/lib/stripe";
import { upsertRidePayment } from "@/lib/ride-payments";
import { getStripeConfigStatus } from "@/lib/stripe-config";

type PaymentsSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
    return_url?: string;
    ride_id?: string;
  }>;
};

function cardStyle() {
  return {
    maxWidth: 520,
    width: "100%",
    background: "#ffffff",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.16)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
  } as const;
}

export default async function PaymentsSuccessPage({
  searchParams,
}: PaymentsSuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id?.trim() || null;
  const returnUrl = params.return_url?.trim() || null;
  const fallbackRideId = params.ride_id?.trim() || null;
  const stripeStatus = getStripeConfigStatus();

  let summary: Awaited<ReturnType<typeof retrieveCheckoutSession>> | null = null;
  let errorMessage: string | null = null;

  if (sessionId && stripeStatus.ready) {
    try {
      summary = await retrieveCheckoutSession(sessionId);
      const rideId = summary.ride_id || fallbackRideId;
      if (rideId) {
        await upsertRidePayment({
          rideId,
          riderId: summary.rider_id,
          stripeCheckoutSessionId: summary.id,
          stripePaymentIntentId: summary.payment_intent_id,
          amountCents: summary.amount_total ?? 0,
          currency: summary.currency || "usd",
          customerEmail: summary.customer_email,
          checkoutUrl: summary.url,
          status: summary.payment_status === "paid" ? "paid" : "failed",
          stripeSessionStatus: summary.status,
          stripePaymentStatus: summary.payment_status,
          paidAt:
            summary.payment_status === "paid"
              ? new Date().toISOString()
              : null,
        });
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Unable to load session status.";
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "linear-gradient(180deg, #f3f4f6 0%, #e2e8f0 100%)",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <section style={cardStyle()}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "#dcfce7",
            color: "#166534",
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          Stripe test checkout
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.1,
            color: "#0f172a",
          }}
        >
          Demo payment submitted
        </h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
          This page is meant for the sprint demo. If you used a Stripe test card,
          the session details below should reflect the sandbox payment state.
        </p>

        {summary ? (
          <div
            style={{
              marginTop: 20,
              background: "#f8fafc",
              borderRadius: 16,
              padding: 18,
              color: "#0f172a",
            }}
          >
            <p>
              <strong>Session:</strong> {summary.id}
            </p>
            <p>
              <strong>Status:</strong> {summary.status || "unknown"}
            </p>
            <p>
              <strong>Payment status:</strong>{" "}
              {summary.payment_status || "unknown"}
            </p>
            <p>
              <strong>Amount:</strong>{" "}
              {formatAmount(summary.amount_total, summary.currency) || "Unavailable"}
            </p>
            <p>
              <strong>Email:</strong> {summary.customer_email || "Not provided"}
            </p>
          </div>
        ) : null}

        {!summary && sessionId ? (
          <p style={{ color: "#475569" }}>
            Session id captured: <code>{sessionId}</code>
          </p>
        ) : null}

        {errorMessage ? (
          <p style={{ color: "#b91c1c", lineHeight: 1.6 }}>{errorMessage}</p>
        ) : null}

        <p style={{ marginTop: 22, color: "#475569", lineHeight: 1.6 }}>
          You can close this browser tab and return to the GusLift app.
        </p>
        {returnUrl ? (
          <a
            href={returnUrl}
            style={{
              display: "inline-flex",
              marginTop: 18,
              textDecoration: "none",
              background: "#1a3a6b",
              color: "#ffffff",
              padding: "12px 18px",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            Return to GusLift
          </a>
        ) : null}
      </section>
    </main>
  );
}
