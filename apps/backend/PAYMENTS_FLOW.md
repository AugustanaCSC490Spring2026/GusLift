# GusLift Payment Flow

This document maps Stripe payments onto the current GusLift ride lifecycle.

## Recommended point to start payment

Do not charge when the rider first requests a ride.

Best point:

1. Rider requests a ride
2. Driver accepts and the rider confirms the match
3. Create a payment authorization or collect payment at that moment
4. Capture the payment after the driver marks the ride complete

Why:

- A request can fail to match, so charging too early creates refund/cancel complexity
- A confirmed ride is the first point where both parties have agreed to the trip
- Capture-on-completion maps well to the existing `Complete ride` action

## Current code touchpoints

- Rider confirms a matched driver in `apps/mobile/app/rider/AvailableDrivers.js`
- Driver completes a ride in `apps/mobile/app/driver/ScheduledRidesDriver.js`
- Ride completion is persisted by `PATCH /api/driver/rides` in `apps/backend/app/api/driver/rides/route.ts`

These are the main integration points for real payments.

## Recommended payment states

Each ride should have a payment state separate from the ride `status`.

- `not_started`
  Meaning: no payment intent or checkout session exists yet
- `authorization_pending`
  Meaning: rider has confirmed the driver and the app is sending the user to Stripe
- `authorized`
  Meaning: Stripe has approved the payment method / hold, but funds are not captured yet
- `capture_pending`
  Meaning: ride is complete and the app is attempting capture
- `captured`
  Meaning: payment was successfully captured
- `canceled`
  Meaning: the ride or payment was canceled before capture
- `failed`
  Meaning: authorization or capture failed and needs operator / user attention

## Recommended transition flow

### Rider side

1. Rider sees a matched driver
2. Rider taps confirm in `AvailableDrivers.js`
3. GusLift creates a Stripe payment object for that ride
4. Rider completes payment authorization
5. Ride moves to:
   - ride status: `accepted`
   - payment status: `authorized`

### Driver side

1. Driver sees the accepted ride in `ScheduledRidesDriver.js`
2. Driver taps `Complete ride`
3. Backend marks ride as completed
4. Backend captures the authorized payment
5. Ride moves to:
   - ride status: `completed`
   - payment status: `captured`

### Cancel / failure cases

- No driver match:
  - keep `payment_status = not_started`
- Rider rejects the match:
  - keep `payment_status = not_started`
- Rider starts checkout but does not finish:
  - move to `failed` or revert to `not_started`
- Ride canceled after authorization but before completion:
  - move to `canceled`
  - cancel the Stripe authorization / payment intent

## Suggested Supabase fields

If you extend the existing `Rides` table, add fields like:

- `payment_status text`
- `stripe_payment_intent_id text`
- `payment_amount_cents integer`
- `payment_currency text`
- `payment_authorized_at timestamptz`
- `payment_captured_at timestamptz`
- `payment_failed_reason text`

If you want cleaner separation, create a `RidePayments` table keyed by `ride_id`.

## Recommended implementation order

### Phase 1: simplest real-payment MVP

- Trigger Stripe payment right after rider confirms a driver
- Save Stripe session / payment metadata to Supabase
- Only show accepted ride details once payment succeeds

This is the easiest step up from the current demo flow.

### Phase 2: better operational model

- Use a Stripe PaymentIntent with manual capture
- Authorize after match confirmation
- Capture after driver marks ride complete

This is the cleaner long-term model.

## Stripe direction

For the current hosted checkout demo, GusLift uses Stripe Checkout.

For a real "authorize now, capture later" flow, Stripe's PaymentIntents API with
manual capture is the better fit than a simple demo checkout redirect.
