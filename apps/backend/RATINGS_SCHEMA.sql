-- GusLift: ratings for completed rides (run once in Supabase SQL editor).
-- ride_id is TEXT so it matches uuid or numeric ride ids from your Rides/rides table.

CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id text NOT NULL,
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  score smallint NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_ride_from_unique UNIQUE (ride_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS ratings_to_user_id_idx ON public.ratings (to_user_id);
