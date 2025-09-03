-- Aktiviere die notwendigen Erweiterungen für Cron Jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Entferne eventuell bereits existierenden Job
SELECT cron.unschedule('daily-faelligkeits-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-faelligkeits-check'
);

-- Erstelle täglichen Cron Job um 6:00 Uhr morgens
SELECT cron.schedule(
  'daily-faelligkeits-check',
  '0 6 * * *', -- Täglich um 6:00 Uhr
  $$
  SELECT
    net.http_post(
      url := 'https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/check-faelligkeiten',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdGd6cm5waXRsc2xpdmR2bHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3OTQxNTgsImV4cCI6MjA2MjM3MDE1OH0.CG2MB4Wcb6Dex8cT75fd0CBspHF55eC11tAjgkmxfKA"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Log die Erstellung des Cron Jobs
INSERT INTO public.system_logs (message) 
VALUES ('Täglicher Fälligkeits-Check Cron Job erstellt - läuft täglich um 6:00 Uhr');