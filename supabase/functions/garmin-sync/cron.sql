-- Cron pg_cron : sync Garmin automatique à 00h05 Paris (= 22h05 UTC été, 23h05 UTC hiver)
-- Garmin finalise le total calories à 23h59 → on sync à 00h05 le jour suivant avec offset=1 (= hier)
-- À exécuter dans Supabase SQL Editor

-- Supprimer l'ancien cron si existant
SELECT cron.unschedule('garmin-daily-sync');

-- Nouveau cron : 22h05 UTC (= 00h05 Paris heure d'été UTC+2)
SELECT cron.schedule(
  'garmin-daily-sync',
  '5 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lhcouyccseuyczcmatoa.supabase.co/functions/v1/garmin-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"days": 1, "offset": 1}'::jsonb
  )
  $$
);

-- Pour vérifier :
-- SELECT * FROM cron.job;

-- Pour supprimer :
-- SELECT cron.unschedule('garmin-daily-sync');
