-- Create the cron job properly (don't try to unschedule first)
SELECT cron.schedule(
    'check-faelligkeiten-daily',
    '0 6 * * *',
    $$
    SELECT net.http_post(
        url := 'https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/check-faelligkeiten',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdGd6cm5waXRsc2xpdmR2bHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3OTQxNTgsImV4cCI6MjA2MjM3MDE1OH0.CG2MB4Wcb6Dex8cT75fd0CBspHF55eC11tAjgkmxfKA"}'::jsonb,
        body := '{"scheduled": true}'::jsonb
    );
    $$
) WHERE NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-faelligkeiten-daily'
);