-- ============================================================
-- Cron-Job: Marktdaten taeglich um 7:00 Uhr abrufen
-- Holt Basiszinssatz (Bundesbank) + VPI (Destatis)
-- ============================================================

-- Bestehenden Job entfernen falls vorhanden
SELECT cron.unschedule('fetch-marktdaten-daily');

-- Taeglich um 7:00 Uhr morgens (UTC) ausfuehren
-- Nutzt den Anon-Key (wie alle anderen Cron-Jobs)
-- Die Edge Function nutzt intern SUPABASE_SERVICE_ROLE_KEY fuer DB-Writes
SELECT cron.schedule(
    'fetch-marktdaten-daily',
    '0 7 * * *',
    $$
    SELECT net.http_post(
        url := 'https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/fetch-marktdaten',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdGd6cm5waXRsc2xpdmR2bHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3OTQxNTgsImV4cCI6MjA2MjM3MDE1OH0.CG2MB4Wcb6Dex8cT75fd0CBspHF55eC11tAjgkmxfKA"}'::jsonb,
        body := '{"scheduled": true}'::jsonb
    );
    $$
);
