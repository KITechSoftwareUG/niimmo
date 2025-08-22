-- Richte einen Cron Job ein, der täglich um 6 Uhr morgens die Mahnstufen prüft
SELECT cron.schedule(
  'daily-mahnstufen-check',
  '0 6 * * *', -- Täglich um 6:00 Uhr
  $$
  SELECT
    net.http_post(
        url:='https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/check-mahnstufen',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdGd6cm5waXRsc2xpdmR2bHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3OTQxNTgsImV4cCI6MjA2MjM3MDE1OH0.CG2MB4Wcb6Dex8cT75fd0CBspHF55eC11tAjgkmxfKA"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) AS request_id;
  $$
);