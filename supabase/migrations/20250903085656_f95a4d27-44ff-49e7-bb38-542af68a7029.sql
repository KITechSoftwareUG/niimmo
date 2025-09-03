-- First, manually update overdue demands that should be marked as due
UPDATE mietforderungen 
SET 
    ist_faellig = true,
    faellig_seit = CURRENT_TIMESTAMP
WHERE 
    faelligkeitsdatum <= CURRENT_DATE 
    AND ist_faellig = false;

-- Check if cron job exists and recreate it properly
SELECT cron.unschedule('check-faelligkeiten-daily');

-- Create the cron job to run daily at 6 AM
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
);