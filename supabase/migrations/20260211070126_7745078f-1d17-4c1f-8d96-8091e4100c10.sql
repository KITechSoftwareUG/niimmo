
-- Tabelle für Sonderfall-Regeln (ersetzt hardcoded Logik wie Noah Weich)
CREATE TABLE public.sonderfall_regeln (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  beschreibung TEXT,
  match_typ TEXT NOT NULL CHECK (match_typ IN ('name_in_verwendungszweck', 'iban_equals', 'verwendungszweck_contains')),
  match_wert TEXT NOT NULL,
  ziel_kategorie TEXT NOT NULL DEFAULT 'Miete',
  ziel_mieter_name TEXT,
  confidence INTEGER NOT NULL DEFAULT 100,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sonderfall_regeln ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can access sonderfall_regeln"
  ON public.sonderfall_regeln FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Initiale Daten: Noah Weich Sonderfall
INSERT INTO public.sonderfall_regeln (name, beschreibung, match_typ, match_wert, ziel_kategorie, ziel_mieter_name, confidence)
VALUES (
  'Noah Weich Kaution→Miete',
  'Zahlungen mit "Weich" und "Mietkaution" im Verwendungszweck sind tatsächlich Mietzahlungen',
  'name_in_verwendungszweck',
  'weich',
  'Miete',
  'weich',
  100
);
