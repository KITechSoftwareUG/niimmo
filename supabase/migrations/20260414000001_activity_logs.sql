-- Activity Log Tabelle für Developer-Monitoring
-- Nur lesbar für info@kitdienstleistungen.de (RLS)
-- Immutable: kein UPDATE, kein DELETE

CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS aktivieren
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Nur der Entwickler darf lesen
CREATE POLICY "dev_read_activity_logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (auth.email() = 'info@kitdienstleistungen.de');

-- Alle eingeloggten User dürfen eigene Einträge schreiben
CREATE POLICY "authenticated_insert_activity_logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Kein UPDATE, kein DELETE (Logs sind immutable)

-- Index für schnelle Abfragen
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs (action);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs (user_id);
