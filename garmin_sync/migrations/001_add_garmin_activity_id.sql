-- Date    : 2026-05-26
-- Epic    : GARMIN-SYNC
-- Impact app : zéro (colonne nullable, ignorée par le code React)
-- Rollback   : ALTER TABLE activities DROP COLUMN garmin_activity_id;

-- Colonne pour déduplication des activités importées depuis Garmin
-- Nullable : les activités saisies manuellement depuis l'appli ont garmin_activity_id = NULL
ALTER TABLE activities ADD COLUMN IF NOT EXISTS garmin_activity_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_garmin_id
  ON activities(user_id, garmin_activity_id)
  WHERE garmin_activity_id IS NOT NULL;
