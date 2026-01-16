-- Erstelle update_updated_at_column Funktion falls nicht vorhanden
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabelle für Nebenkostenarten pro Immobilie
CREATE TABLE public.nebenkostenarten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  immobilie_id UUID NOT NULL REFERENCES public.immobilien(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  verteilerschluessel_art TEXT NOT NULL DEFAULT 'qm',
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabelle für individuelle Anteile pro Einheit und Nebenkostenart
CREATE TABLE public.nebenkosten_anteile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nebenkostenart_id UUID NOT NULL REFERENCES public.nebenkostenarten(id) ON DELETE CASCADE,
  einheit_id UUID NOT NULL REFERENCES public.einheiten(id) ON DELETE CASCADE,
  anteil_wert NUMERIC DEFAULT 0,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(nebenkostenart_id, einheit_id)
);

-- Tabelle für Nebenkostenzahlungen
CREATE TABLE public.nebenkosten_zahlungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zahlung_id UUID NOT NULL REFERENCES public.zahlungen(id) ON DELETE CASCADE,
  nebenkostenart_id UUID REFERENCES public.nebenkostenarten(id) ON DELETE SET NULL,
  einheit_id UUID REFERENCES public.einheiten(id) ON DELETE SET NULL,
  verteilung_typ TEXT NOT NULL DEFAULT 'automatisch',
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(zahlung_id)
);

-- RLS aktivieren
ALTER TABLE public.nebenkostenarten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nebenkosten_anteile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nebenkosten_zahlungen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Only admin can access nebenkostenarten" 
ON public.nebenkostenarten FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admin can access nebenkosten_anteile" 
ON public.nebenkosten_anteile FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admin can access nebenkosten_zahlungen" 
ON public.nebenkosten_zahlungen FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger für aktualisiert_am
CREATE TRIGGER update_nebenkostenarten_updated_at
BEFORE UPDATE ON public.nebenkostenarten
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nebenkosten_anteile_updated_at
BEFORE UPDATE ON public.nebenkosten_anteile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();