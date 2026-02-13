
-- Update the existing auto_set_beendet_status trigger function to also handle 'gekuendigt'
CREATE OR REPLACE FUNCTION public.auto_set_beendet_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Wenn ende_datum gesetzt und in der Vergangenheit liegt -> beendet
  IF NEW.ende_datum IS NOT NULL AND NEW.ende_datum < CURRENT_DATE THEN
    NEW.status := 'beendet';
  -- Wenn ende_datum gesetzt und in der Zukunft/heute liegt und Status noch aktiv -> gekuendigt
  ELSIF NEW.ende_datum IS NOT NULL AND NEW.ende_datum >= CURRENT_DATE AND NEW.status = 'aktiv' THEN
    NEW.status := 'gekuendigt';
  -- Wenn ende_datum entfernt wird und Status gekuendigt war -> zurück auf aktiv
  ELSIF NEW.ende_datum IS NULL AND OLD.ende_datum IS NOT NULL AND NEW.status = 'gekuendigt' THEN
    NEW.status := 'aktiv';
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on mietvertrag
DROP TRIGGER IF EXISTS auto_set_beendet_status_trigger ON mietvertrag;
CREATE TRIGGER auto_set_beendet_status_trigger
  BEFORE INSERT OR UPDATE ON mietvertrag
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_beendet_status();

-- Fix the existing contract: Objekt 7 Einheit 1
UPDATE mietvertrag 
SET status = 'gekuendigt'
WHERE id = '00000000-0000-0000-0000-000000701001'
AND ende_datum IS NOT NULL 
AND ende_datum >= CURRENT_DATE
AND status = 'aktiv';
