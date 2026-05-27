-- Cron pg_cron : sync Garmin automatique chaque matin à 7h (UTC+2 Paris = 5h UTC)
-- À exécuter dans Supabase SQL Editor avec l'extension pg_cron activée

SELECT cron.schedule(
  'garmin-daily-sync',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lhcouyccseuyczcmatoa.supabase.co/functions/v1/garmin-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"days": 1}'::jsonb
  )
  $$
);

-- Pour vérifier le cron :
-- SELECT * FROM cron.job;

-- Pour supprimer le cron :
-- SELECT cron.unschedule('garmin-daily-sync');
