import { updateRidePaymentStatus } from "@/lib/ride-payments";

type PaymentsCancelPageProps = {
  searchParams: Promise<{
    ride_id?: string;
    return_url?: string;
  }>;
};

export default async function PaymentsCancelPage({
  searchParams,
}: PaymentsCancelPageProps) {
  const params = await searchParams;
  const rideId = params.ride_id?.trim() || null;
  const returnUrl = params.return_url?.trim() || null;

  if (rideId) {
    try {
      await updateRidePaymentStatus({
        rideId,
        status: "canceled",
      });
    } catch (_) {}
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
          "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <section
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#ffffff",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.14)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "6px 12px",
            borderRadius: 999,
            background: "#fee2e2",
            color: "#991b1b",
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          Checkout canceled
        </div>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: "#0f172a" }}>
          No payment was completed
        </h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
          The Stripe test checkout was canceled before completion. You can close
          this page and return to GusLift, or start the demo checkout again.
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
