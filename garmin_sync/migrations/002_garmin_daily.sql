CREATE TABLE IF NOT EXISTS garmin_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  total_kcal integer NOT NULL,
  active_kcal integer NOT NULL DEFAULT 0,
  bmr_kcal integer NOT NULL DEFAULT 0,
  steps integer NOT NULL DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE garmin_daily ENABLE ROW LEVEL SECURITY;
GRANT ALL ON garmin_daily TO authenticated;
CREATE POLICY "Users see own garmin_daily" ON garmin_daily FOR ALL USING (auth.uid() = user_id);
