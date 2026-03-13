
-- Create history table
CREATE TABLE public.zaehlerstand_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einheit_id uuid REFERENCES einheiten(id) ON DELETE CASCADE,
  immobilie_id uuid REFERENCES immobilien(id) ON DELETE CASCADE,
  zaehler_typ text NOT NULL,
  zaehler_nummer text,
  stand numeric,
  datum date NOT NULL,
  quelle text DEFAULT 'manuell',
  erstellt_am timestamptz DEFAULT now(),
  erstellt_von uuid
);

ALTER TABLE public.zaehlerstand_historie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin or Hausmeister can access zaehlerstand_historie"
  ON public.zaehlerstand_historie FOR ALL TO public
  USING (is_admin(auth.uid()) OR is_hausmeister(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_hausmeister(auth.uid()));

CREATE POLICY "Authenticated can read zaehlerstand_historie"
  ON public.zaehlerstand_historie FOR SELECT TO authenticated
  USING (true);

-- Backfill from einheiten
INSERT INTO zaehlerstand_historie (einheit_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'kaltwasser', kaltwasser_zaehler, kaltwasser_stand_aktuell, COALESCE(kaltwasser_stand_datum, CURRENT_DATE), 'manuell'
FROM einheiten WHERE kaltwasser_stand_aktuell IS NOT NULL;

INSERT INTO zaehlerstand_historie (einheit_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'warmwasser', warmwasser_zaehler, warmwasser_stand_aktuell, COALESCE(warmwasser_stand_datum, CURRENT_DATE), 'manuell'
FROM einheiten WHERE warmwasser_stand_aktuell IS NOT NULL;

INSERT INTO zaehlerstand_historie (einheit_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'strom', strom_zaehler, strom_stand_aktuell, COALESCE(strom_stand_datum, CURRENT_DATE), 'manuell'
FROM einheiten WHERE strom_stand_aktuell IS NOT NULL;

INSERT INTO zaehlerstand_historie (einheit_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'gas', gas_zaehler, gas_stand_aktuell, COALESCE(gas_stand_datum, CURRENT_DATE), 'manuell'
FROM einheiten WHERE gas_stand_aktuell IS NOT NULL;

-- Backfill from immobilien (Hausanschluss)
INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'wasser', allgemein_wasser_zaehler, allgemein_wasser_stand, COALESCE(allgemein_wasser_datum, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_wasser_stand IS NOT NULL;

INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'strom', allgemein_strom_zaehler, allgemein_strom_stand, COALESCE(allgemein_strom_datum, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_strom_stand IS NOT NULL;

INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'gas', allgemein_gas_zaehler, allgemein_gas_stand, COALESCE(allgemein_gas_datum, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_gas_stand IS NOT NULL;

INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'wasser_2', allgemein_wasser_zaehler_2, allgemein_wasser_stand_2, COALESCE(allgemein_wasser_datum_2, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_wasser_stand_2 IS NOT NULL;

INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'strom_2', allgemein_strom_zaehler_2, allgemein_strom_stand_2, COALESCE(allgemein_strom_datum_2, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_strom_stand_2 IS NOT NULL;

INSERT INTO zaehlerstand_historie (immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'gas_2', allgemein_gas_zaehler_2, allgemein_gas_stand_2, COALESCE(allgemein_gas_datum_2, CURRENT_DATE), 'manuell'
FROM immobilien WHERE allgemein_gas_stand_2 IS NOT NULL;
