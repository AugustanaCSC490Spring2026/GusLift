create table if not exists "Notifications" (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  idempotency_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table "User"
  add column if not exists email text;

alter table "Notifications"
  add column if not exists email_to text,
  add column if not exists email_status text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

create unique index if not exists notifications_idempotency_key_idx
  on "Notifications" (idempotency_key)
  where idempotency_key is not null;

create index if not exists notifications_user_created_at_idx
  on "Notifications" (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on "Notifications" (user_id, read_at)
  where read_at is null;
