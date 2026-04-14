create extension if not exists pgcrypto;

create table if not exists "RidePayments" (
  id uuid primary key default gen_random_uuid(),
  ride_id text not null unique,
  rider_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  customer_email text,
  checkout_url text,
  status text not null default 'checkout_created',
  stripe_session_status text,
  stripe_payment_status text,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ride_payments_rider_id_idx
  on "RidePayments" (rider_id);

create index if not exists ride_payments_status_idx
  on "RidePayments" (status);
