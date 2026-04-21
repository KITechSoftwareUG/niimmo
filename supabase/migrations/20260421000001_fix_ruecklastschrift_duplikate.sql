-- Fix: Rücklastschrift-Gebühr Duplikate in mietforderungen bereinigen
-- Ursache: Trigger feuerte mehrfach (Race Condition + Re-Runs) ohne Duplikat-Check
--
-- 1) Duplikate löschen: Pro (mietvertrag_id, sollmonat, sollbetrag, faelligkeitsdatum)
--    immer nur den ältesten Eintrag behalten
-- 2) Trigger reparieren:
--    a) DATE-Format-Bug: zugeordneter_monat 'YYYY-MM' → DATE 'YYYY-MM-01'
--    b) Existenz-Check vor INSERT (Race-Condition-Schutz)

-- Schritt 1: Duplikate löschen
DELETE FROM mietforderungen
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY mietvertrag_id, sollmonat, sollbetrag, faelligkeitsdatum
        ORDER BY erzeugt_am ASC
      ) AS rn
    FROM mietforderungen
  ) ranked
  WHERE rn > 1
);

-- Schritt 2: Trigger-Funktion reparieren
CREATE OR REPLACE FUNCTION public.create_ruecklastschrift_forderung()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    contract_record RECORD;
    sollmonat_date DATE;
    gebuehr NUMERIC;
BEGIN
    IF NEW.kategorie = 'Rücklastschrift' AND NEW.mietvertrag_id IS NOT NULL THEN
        SELECT * INTO contract_record
        FROM mietvertrag
        WHERE id = NEW.mietvertrag_id
        AND lastschrift = true;

        IF FOUND THEN
            -- DATE-Fix: zugeordneter_monat ist 'YYYY-MM' (TEXT) → DATE 'YYYY-MM-01'
            -- Nach der sollmonat TEXT→DATE Migration muss hier korrekt konvertiert werden
            IF NEW.zugeordneter_monat IS NOT NULL THEN
                sollmonat_date := (NEW.zugeordneter_monat || '-01')::date;
            ELSE
                sollmonat_date := DATE_TRUNC('month', NEW.buchungsdatum)::date;
            END IF;

            gebuehr := COALESCE(contract_record.ruecklastschrift_gebuehr, 7.50);

            -- Race-Condition-Schutz: Nur einfügen wenn für dieses exakte RL-Ereignis
            -- (identifiziert durch mietvertrag + sollmonat + betrag + fälligkeitsdatum)
            -- noch keine Forderung existiert
            IF NOT EXISTS (
                SELECT 1 FROM mietforderungen
                WHERE mietvertrag_id = NEW.mietvertrag_id
                  AND sollmonat = sollmonat_date
                  AND sollbetrag = gebuehr
                  AND faelligkeitsdatum = NEW.buchungsdatum
            ) THEN
                INSERT INTO mietforderungen (
                    mietvertrag_id,
                    sollmonat,
                    sollbetrag,
                    ist_faellig,
                    faelligkeitsdatum,
                    faellig_seit
                ) VALUES (
                    NEW.mietvertrag_id,
                    sollmonat_date,
                    gebuehr,
                    true,
                    NEW.buchungsdatum,
                    CURRENT_TIMESTAMP
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
