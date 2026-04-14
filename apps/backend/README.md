This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Stripe starter

The backend now includes a small Stripe integration scaffold:

- `lib/stripe-config.ts` centralizes Stripe env lookup and readiness checks
- `GET /api/payments/config` reports whether Stripe keys are configured
- `POST /api/payments/checkout-session` creates a hosted Stripe test checkout
- `GET /api/payments/checkout-session?session_id=...` retrieves session status
- `/payments/success` and `/payments/cancel` provide demo landing pages after checkout

Add these variables to your backend `.env.local` before wiring up checkout flows:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

Example response from `GET /api/payments/config`:

```json
{
  "provider": "stripe",
  "ready": false,
  "publishableKeyConfigured": false,
  "secretKeyConfigured": false,
  "mode": "unknown"
}
```

The checkout session route currently creates a fixed demo-friendly card payment
line item and is a good sprint-demo bridge before a full ride-fare model,
webhook handling, and persistent payment records.

## RidePayments setup

To persist Stripe checkout metadata for real ride payments, create the
`RidePayments` table in Supabase using:

```sql
\i apps/backend/sql/ride_payments.sql
```

If you prefer the Supabase SQL editor, copy the contents of
`apps/backend/sql/ride_payments.sql` and run it there once.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/route.ts`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API Routes

This directory contains example API routes for the headless API app.

For more details, see [route.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route).
