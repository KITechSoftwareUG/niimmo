-- Kostenpositionen: Der zentrale Layer für die Nebenkostenabrechnung
-- Eine Zahlung kann mehrere Kostenpositionen erzeugen (z.B. Jahresrechnung → 12 Monate)

CREATE TABLE public.kostenpositionen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Verknüpfungen
  zahlung_id UUID REFERENCES public.zahlungen(id) ON DELETE SET NULL,
  nebenkostenart_id UUID REFERENCES public.nebenkostenarten(id) ON DELETE SET NULL,
  immobilie_id UUID NOT NULL REFERENCES public.immobilien(id) ON DELETE CASCADE,
  
  -- Beträge
  gesamtbetrag NUMERIC NOT NULL,
  
  -- Zeitraum (kritisch für zeitanteilige Berechnung)
  zeitraum_von DATE NOT NULL,
  zeitraum_bis DATE NOT NULL,
  
  -- Metadaten
  bezeichnung TEXT, -- z.B. "Gebäudeversicherung 2024"
  quelle TEXT NOT NULL DEFAULT 'zahlung', -- 'zahlung', 'manuell', 'ki_klassifiziert'
  ist_umlagefaehig BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  erstellt_von UUID REFERENCES auth.users(id),
  
  -- Constraint: zeitraum_bis muss nach zeitraum_von sein
  CONSTRAINT valid_zeitraum CHECK (zeitraum_bis >= zeitraum_von)
);

-- Kostenanteile pro Einheit (berechnet aus Kostenposition + Verteilerschlüssel)
CREATE TABLE public.kostenposition_anteile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kostenposition_id UUID NOT NULL REFERENCES public.kostenpositionen(id) ON DELETE CASCADE,
  einheit_id UUID NOT NULL REFERENCES public.einheiten(id) ON DELETE CASCADE,
  
  -- Berechnete Werte
  anteil_prozent NUMERIC NOT NULL, -- z.B. 15.5 für 15.5%
  anteil_betrag NUMERIC NOT NULL, -- Tatsächlicher Betrag
  
  -- Wie wurde berechnet
  verteilerschluessel_art TEXT NOT NULL, -- 'qm', 'personen', 'einheiten', 'verbrauch'
  bezugsgroesse_einheit NUMERIC, -- z.B. 85 qm
  bezugsgroesse_gesamt NUMERIC, -- z.B. 550 qm gesamt
  
  -- Zeitanteilig (falls Mieter nur Teil des Jahres)
  zeitraum_von DATE,
  zeitraum_bis DATE,
  zeitanteil_faktor NUMERIC DEFAULT 1.0, -- z.B. 0.5 für 6 Monate
  
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ist_umlagefaehig Flag auf nebenkostenarten hinzufügen
ALTER TABLE public.nebenkostenarten 
ADD COLUMN IF NOT EXISTS ist_umlagefaehig BOOLEAN NOT NULL DEFAULT true;

-- Beschreibung für Nebenkostenarten (für UI)
ALTER TABLE public.nebenkostenarten 
ADD COLUMN IF NOT EXISTS beschreibung TEXT;

-- RLS aktivieren
ALTER TABLE public.kostenpositionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kostenposition_anteile ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Only admin can access kostenpositionen" 
ON public.kostenpositionen 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admin can access kostenposition_anteile" 
ON public.kostenposition_anteile 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger für aktualisiert_am
CREATE TRIGGER update_kostenpositionen_updated_at
BEFORE UPDATE ON public.kostenpositionen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index für schnelle Abfragen
CREATE INDEX idx_kostenpositionen_immobilie ON public.kostenpositionen(immobilie_id);
CREATE INDEX idx_kostenpositionen_zeitraum ON public.kostenpositionen(zeitraum_von, zeitraum_bis);
CREATE INDEX idx_kostenpositionen_zahlung ON public.kostenpositionen(zahlung_id);
CREATE INDEX idx_kostenposition_anteile_kostenposition ON public.kostenposition_anteile(kostenposition_id);
CREATE INDEX idx_kostenposition_anteile_einheit ON public.kostenposition_anteile(einheit_id);

-- Hilfsfunktion: Berechne Zeitanteil
CREATE OR REPLACE FUNCTION public.calculate_zeitanteil(
  position_von DATE,
  position_bis DATE,
  abrechnungs_von DATE,
  abrechnungs_bis DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  overlap_start DATE;
  overlap_end DATE;
  position_days INTEGER;
  overlap_days INTEGER;
BEGIN
  -- Berechne Überlappung
  overlap_start := GREATEST(position_von, abrechnungs_von);
  overlap_end := LEAST(position_bis, abrechnungs_bis);
  
  -- Keine Überlappung
  IF overlap_start > overlap_end THEN
    RETURN 0;
  END IF;
  
  -- Berechne Tage
  position_days := position_bis - position_von + 1;
  overlap_days := overlap_end - overlap_start + 1;
  
  -- Vermeide Division durch 0
  IF position_days = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(overlap_days::NUMERIC / position_days::NUMERIC, 4);
END;
$$;