-- Migration: sollmonat TEXT -> DATE
-- Konvertiert 'YYYY-MM' zu DATE (erster des Monats, z.B. '2026-01-01')
-- Alle Funktionen die (sollmonat || '-01')::date nutzen werden aktualisiert

-- 1. Spaltentyp ändern: TEXT -> DATE
ALTER TABLE public.mietforderungen
  ALTER COLUMN sollmonat TYPE date
  USING (sollmonat || '-01')::date;

-- 2. Trigger-Funktion aktualisieren: set_faelligkeitsdatum_trigger
--    Vorher: (NEW.sollmonat || '-01')::date + INTERVAL '7 days'
--    Nachher: NEW.sollmonat + INTERVAL '7 days'  (sollmonat ist jetzt DATE)
CREATE OR REPLACE FUNCTION public.set_faelligkeitsdatum_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.faelligkeitsdatum IS NULL THEN
    -- sollmonat ist jetzt DATE (erster des Monats), +7 Tage = 8. des Monats
    NEW.faelligkeitsdatum := NEW.sollmonat + INTERVAL '7 days';
  END IF;

  IF NEW.faelligkeitsdatum <= CURRENT_DATE THEN
    NEW.ist_faellig := true;
    NEW.faellig_seit := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. check_and_update_mahnstufen: Fallback-Berechnung ohne || '-01'
CREATE OR REPLACE FUNCTION public.check_and_update_mahnstufen()
RETURNS TABLE(
  mietvertrag_id uuid,
  alte_mahnstufe integer,
  neue_mahnstufe integer,
  grund text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vertrag_record RECORD;
  forderung_record RECORD;
  zahlung_exists boolean;
  forderung_datum date;
  neue_stufe integer;
BEGIN
  FOR vertrag_record IN
    SELECT * FROM mietvertrag
    WHERE status = 'aktiv'
  LOOP
    neue_stufe := COALESCE(vertrag_record.mahnstufe, 0);

    FOR forderung_record IN
      SELECT * FROM mietforderungen
      WHERE mietvertrag_id = vertrag_record.id
      ORDER BY sollmonat
    LOOP
      -- sollmonat ist jetzt DATE, kein || '-01' mehr nötig
      forderung_datum := COALESCE(
        forderung_record.faelligkeitsdatum,
        forderung_record.sollmonat + INTERVAL '7 days'
      );

      SELECT EXISTS(
        SELECT 1 FROM zahlungen z
        WHERE z.mietvertrag_id = vertrag_record.id
        AND z.buchungsdatum BETWEEN (forderung_datum - INTERVAL '14 days')
                                AND (forderung_datum + INTERVAL '7 days')
        AND ABS(z.betrag - forderung_record.sollbetrag) <= 50
        AND z.kategorie = 'Miete'
      ) INTO zahlung_exists;

      IF NOT zahlung_exists AND forderung_datum < CURRENT_DATE THEN
        neue_stufe := LEAST(neue_stufe + 1, 3);

        UPDATE mietvertrag
        SET
          mahnstufe = neue_stufe,
          letzte_mahnung_am = CURRENT_TIMESTAMP,
          naechste_mahnung_am = CURRENT_DATE + INTERVAL '30 days'
        WHERE id = vertrag_record.id;

        mietvertrag_id := vertrag_record.id;
        alte_mahnstufe := COALESCE(vertrag_record.mahnstufe, 0);
        neue_mahnstufe := neue_stufe;
        -- TO_CHAR weil sollmonat jetzt DATE ist (keine direkte String-Konkatenation)
        grund := 'Keine Miete-Zahlung für ' || TO_CHAR(forderung_record.sollmonat, 'YYYY-MM') || ' im Zeitraum ±14/7 Tage gefunden';

        RETURN NEXT;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- 4. update_forderungen_on_rent_change: String-Vergleich -> DATE-Vergleich
CREATE OR REPLACE FUNCTION public.update_forderungen_on_rent_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.kaltmiete IS DISTINCT FROM NEW.kaltmiete
     OR OLD.betriebskosten IS DISTINCT FROM NEW.betriebskosten THEN
    UPDATE public.mietforderungen
    SET sollbetrag = COALESCE(NEW.kaltmiete, 0) + COALESCE(NEW.betriebskosten, 0)
    WHERE mietvertrag_id = NEW.id
      -- sollmonat ist DATE, Vergleich mit DATE_TRUNC statt TO_CHAR String-Vergleich
      AND sollmonat >= DATE_TRUNC('month', CURRENT_DATE)::date
      AND sollbetrag = COALESCE(OLD.kaltmiete, 0) + COALESCE(OLD.betriebskosten, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. update_faellige_forderungen: Rückgabe-Typ von text zu date
-- CREATE OR REPLACE kann Return-Typ nicht ändern → erst DROP dann CREATE
DROP FUNCTION IF EXISTS public.update_faellige_forderungen();
CREATE FUNCTION public.update_faellige_forderungen()
RETURNS TABLE(
  forderung_id uuid,
  mietvertrag_id uuid,
  sollmonat date,
  sollbetrag numeric,
  faelligkeitsdatum date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE mietforderungen
  SET
    ist_faellig = true,
    faellig_seit = CURRENT_TIMESTAMP
  WHERE
    faelligkeitsdatum <= CURRENT_DATE
    AND ist_faellig = false
  RETURNING
    id as forderung_id,
    mietforderungen.mietvertrag_id,
    mietforderungen.sollmonat,
    mietforderungen.sollbetrag,
    mietforderungen.faelligkeitsdatum;
END;
$$;
