
-- Darlehen/Kredite Haupttabelle
CREATE TABLE public.darlehen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bezeichnung TEXT NOT NULL,
  bank TEXT,
  kontonummer TEXT,
  darlehensbetrag NUMERIC NOT NULL DEFAULT 0,
  restschuld NUMERIC DEFAULT 0,
  zinssatz_prozent NUMERIC DEFAULT 0,
  tilgungssatz_prozent NUMERIC DEFAULT 0,
  monatliche_rate NUMERIC DEFAULT 0,
  start_datum DATE,
  ende_datum DATE,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- N-zu-N Zuordnung Darlehen <-> Immobilien (optional, nur informativ)
CREATE TABLE public.darlehen_immobilien (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  darlehen_id UUID NOT NULL REFERENCES public.darlehen(id) ON DELETE CASCADE,
  immobilie_id UUID NOT NULL REFERENCES public.immobilien(id) ON DELETE CASCADE,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(darlehen_id, immobilie_id)
);

-- Darlehen-Zahlungen: verknüpft automatisch erkannte oder manuell zugeordnete Zahlungen
CREATE TABLE public.darlehen_zahlungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  darlehen_id UUID NOT NULL REFERENCES public.darlehen(id) ON DELETE CASCADE,
  zahlung_id UUID REFERENCES public.zahlungen(id) ON DELETE SET NULL,
  buchungsdatum DATE NOT NULL,
  betrag NUMERIC NOT NULL DEFAULT 0,
  zinsanteil NUMERIC DEFAULT 0,
  tilgungsanteil NUMERIC DEFAULT 0,
  restschuld_danach NUMERIC,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.darlehen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.darlehen_immobilien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.darlehen_zahlungen ENABLE ROW LEVEL SECURITY;

-- Nur Admin darf auf Darlehen zugreifen
CREATE POLICY "Only admin can access darlehen" ON public.darlehen FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Only admin can access darlehen_immobilien" ON public.darlehen_immobilien FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Only admin can access darlehen_zahlungen" ON public.darlehen_zahlungen FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trigger für aktualisiert_am
CREATE TRIGGER update_darlehen_updated_at
  BEFORE UPDATE ON public.darlehen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
