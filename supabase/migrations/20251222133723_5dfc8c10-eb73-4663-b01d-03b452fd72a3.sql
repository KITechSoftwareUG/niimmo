-- Backfill: Alle abgelaufenen Verträge auf 'beendet' setzen
UPDATE mietvertrag
SET status = 'beendet'
WHERE ende_datum IS NOT NULL 
  AND ende_datum < CURRENT_DATE 
  AND status != 'beendet';

-- Trigger-Funktion: Setzt status auf 'beendet' wenn ende_datum in der Vergangenheit
CREATE OR REPLACE FUNCTION public.auto_set_beendet_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Wenn ende_datum gesetzt und in der Vergangenheit liegt
  IF NEW.ende_datum IS NOT NULL AND NEW.ende_datum < CURRENT_DATE THEN
    NEW.status := 'beendet';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger auf mietvertrag-Tabelle
DROP TRIGGER IF EXISTS trigger_auto_set_beendet ON mietvertrag;
CREATE TRIGGER trigger_auto_set_beendet
  BEFORE INSERT OR UPDATE ON mietvertrag
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_beendet_status();