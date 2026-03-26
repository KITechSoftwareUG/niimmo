-- ============================================================
-- Marktdaten: Basiszinssatz (Bundesbank) + VPI (Destatis)
-- Wird taeglich per Edge Function fetch-marktdaten aktualisiert
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marktdaten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ TEXT NOT NULL CHECK (typ IN ('basiszinssatz', 'vpi')),
  wert NUMERIC(10,4) NOT NULL,
  stichtag DATE NOT NULL,
  quelle TEXT NOT NULL,
  abgerufen_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eindeutiger Index: pro Typ + Stichtag nur ein Eintrag
CREATE UNIQUE INDEX IF NOT EXISTS idx_marktdaten_typ_stichtag ON public.marktdaten (typ, stichtag);

-- Index fuer schnellen Zugriff auf den aktuellsten Wert
CREATE INDEX IF NOT EXISTS idx_marktdaten_typ_abgerufen ON public.marktdaten (typ, abgerufen_am DESC);

COMMENT ON TABLE public.marktdaten IS 'Automatisch abgerufene Marktdaten: Basiszinssatz der Bundesbank und Verbraucherpreisindex (VPI) von Destatis.';
COMMENT ON COLUMN public.marktdaten.typ IS 'basiszinssatz oder vpi';
COMMENT ON COLUMN public.marktdaten.wert IS 'Basiszinssatz in % (z.B. 1.27) oder VPI-Index (z.B. 123.1)';
COMMENT ON COLUMN public.marktdaten.stichtag IS 'Datum ab dem der Wert gilt';
COMMENT ON COLUMN public.marktdaten.quelle IS 'URL oder Beschreibung der Datenquelle';

-- RLS aktivieren
ALTER TABLE public.marktdaten ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Nutzer duerfen lesen
CREATE POLICY "marktdaten_read" ON public.marktdaten
  FOR SELECT TO authenticated USING (true);

-- Nur service_role darf schreiben (Edge Function)
CREATE POLICY "marktdaten_service_write" ON public.marktdaten
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Angespannte Wohnungsmaerkte: Statische Lookup-Tabelle
-- Basiert auf Landesverordnungen (z.B. Nds. Mieterschutzverordnung)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.angespannte_maerkte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeinde TEXT NOT NULL,
  bundesland TEXT NOT NULL,
  kappungsgrenze_prozent NUMERIC(4,1) NOT NULL DEFAULT 15.0,
  verordnung TEXT,
  gueltig_bis DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_angespannte_gemeinde_bl ON public.angespannte_maerkte (gemeinde, bundesland);

COMMENT ON TABLE public.angespannte_maerkte IS 'Gemeinden mit angespanntem Wohnungsmarkt gemaess Landesverordnungen. Kappungsgrenze 15% statt 20%.';
COMMENT ON COLUMN public.angespannte_maerkte.kappungsgrenze_prozent IS 'Kappungsgrenze in %, normalerweise 15.0 fuer angespannte Maerkte';
COMMENT ON COLUMN public.angespannte_maerkte.gueltig_bis IS 'Ablaufdatum der Verordnung';

-- RLS
ALTER TABLE public.angespannte_maerkte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "angespannte_maerkte_read" ON public.angespannte_maerkte
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "angespannte_maerkte_service_write" ON public.angespannte_maerkte
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Seed: Niedersachsen - 57 Gemeinden (Nds. GVBl. 2024 Nr. 122)
-- Kappungsgrenze (§2) gueltig bis 31.12.2029
-- ============================================================

INSERT INTO public.angespannte_maerkte (gemeinde, bundesland, kappungsgrenze_prozent, verordnung, gueltig_bis) VALUES
  -- Staedte / Hansestaedte
  ('Hannover', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Braunschweig', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Buxtehude', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Lüneburg', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Stade', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Uelzen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Achim', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Bleckede', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Borkum', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Buchholz in der Nordheide', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Cuxhaven', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Garbsen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Göttingen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Hemmingen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Hildesheim', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Laatzen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Langenhagen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Leer (Ostfriesland)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Lingen (Ems)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Norden', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Norderney', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Nordhorn', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Oldenburg (Oldenburg)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Osnabrück', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Rotenburg (Wümme)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Seelze', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Winsen (Luhe)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Wolfsburg', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Wunstorf', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  -- Flecken / Gemeinden / Samtgemeinden
  ('Bovenden', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Juist', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Wangerooge', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Adendorf', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Bad Rothenfelde', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Bad Zwischenahn', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Baltrum', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Bienenbüttel', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Emsbüren', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Hatten', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Isernhagen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Langeoog', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Lilienthal', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Neu Wulmstorf', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Oyten', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Rastede', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Seevetal', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Spiekeroog', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Stuhr', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Wedemark', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Weyhe', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Winsen (Aller)', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Bardowick', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Gellersen', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Hanstedt', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Ilmenau', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Ostheide', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31'),
  ('Tostedt', 'Niedersachsen', 15.0, 'Nds. Mieterschutzverordnung 2024, §2', '2029-12-31')
ON CONFLICT (gemeinde, bundesland) DO NOTHING;

-- ============================================================
-- View: Aktuellste Marktdaten schnell abrufbar
-- ============================================================

CREATE OR REPLACE VIEW public.aktuelle_marktdaten AS
SELECT DISTINCT ON (typ)
  typ,
  wert,
  stichtag,
  quelle,
  abgerufen_am
FROM public.marktdaten
ORDER BY typ, stichtag DESC, abgerufen_am DESC;

COMMENT ON VIEW public.aktuelle_marktdaten IS 'Zeigt den jeweils aktuellsten Basiszinssatz und VPI-Wert.';
