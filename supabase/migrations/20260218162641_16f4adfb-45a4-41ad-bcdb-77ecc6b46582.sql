
-- Neue Tabelle für Versicherungen pro Immobilie
CREATE TABLE public.versicherungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  immobilie_id UUID NOT NULL REFERENCES public.immobilien(id) ON DELETE CASCADE,
  typ TEXT NOT NULL, -- z.B. 'Wohngebäudeversicherung', 'Haftpflichtversicherung'
  firma TEXT,
  kontaktperson TEXT,
  email TEXT,
  telefon TEXT,
  vertragsnummer TEXT,
  jahresbeitrag NUMERIC,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.versicherungen ENABLE ROW LEVEL SECURITY;

-- Nur Admin kann auf Versicherungen zugreifen
CREATE POLICY "Only admin can access versicherungen"
ON public.versicherungen
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger für aktualisiert_am
CREATE TRIGGER update_versicherungen_updated_at
BEFORE UPDATE ON public.versicherungen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Kategorie-Enum erweitern um 'Versicherungen'
ALTER TYPE public.kategorie ADD VALUE IF NOT EXISTS 'Versicherungen';
