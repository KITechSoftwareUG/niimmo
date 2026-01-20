-- Tabelle für konfigurierbare Nichtmiete-Regeln (Versorger, Darlehen etc.)
CREATE TABLE public.nichtmiete_regeln (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regel_typ TEXT NOT NULL CHECK (regel_typ IN ('empfaenger_contains', 'empfaenger_equals', 'iban_equals', 'verwendungszweck_contains')),
  wert TEXT NOT NULL,
  beschreibung TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nichtmiete_regeln ENABLE ROW LEVEL SECURITY;

-- Only admin can manage rules
CREATE POLICY "Only admin can access nichtmiete_regeln" 
ON public.nichtmiete_regeln 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Insert default rules (from current hardcoded values)
INSERT INTO public.nichtmiete_regeln (regel_typ, wert, beschreibung) VALUES
  ('empfaenger_contains', 'Avacon', 'Energieversorger Avacon'),
  ('empfaenger_contains', 'Darlehen', 'Kreditzahlungen'),
  ('empfaenger_contains', 'Leine ', 'Leine-Versorger'),
  ('empfaenger_contains', 'Stadtwerk', 'Stadtwerke allgemein'),
  ('empfaenger_equals', 'EVI ENERGIEVERSORGUNG HILDESHEIM GMBH CO. KG', 'EVI Hildesheim'),
  ('empfaenger_equals', 'Wasserzweckverband Peine', 'Wasserversorger Peine'),
  ('verwendungszweck_contains', 'Retoure SEPA Lastschrift', 'Rücklastschrift-Erkennung');

-- Trigger for updated_at
CREATE TRIGGER update_nichtmiete_regeln_updated_at
BEFORE UPDATE ON public.nichtmiete_regeln
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();