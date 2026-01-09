-- Fix the due date logic: faelligkeitsdatum should be in the same month as sollmonat
-- Currently: sollmonat + 1 month + 7 days (wrong)
-- Fixed: sollmonat + 7 days (correct, e.g., 2026-01-08 for sollmonat 2026-01)

CREATE OR REPLACE FUNCTION public.set_faelligkeitsdatum_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Setze Fälligkeitsdatum auf 7 Tage nach Monatsbeginn (im selben Monat)
  IF NEW.faelligkeitsdatum IS NULL THEN
    NEW.faelligkeitsdatum := (NEW.sollmonat || '-01')::date + INTERVAL '7 days';
  END IF;
  
  -- Prüfe ob bereits fällig
  IF NEW.faelligkeitsdatum <= CURRENT_DATE THEN
    NEW.ist_faellig := true;
    NEW.faellig_seit := CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also fix existing mietforderungen with wrong faelligkeitsdatum
UPDATE mietforderungen
SET faelligkeitsdatum = (sollmonat || '-01')::date + INTERVAL '7 days'
WHERE faelligkeitsdatum = (sollmonat || '-01')::date + INTERVAL '1 month' + INTERVAL '7 days';

-- Update ist_faellig for corrected records
UPDATE mietforderungen
SET 
  ist_faellig = true,
  faellig_seit = COALESCE(faellig_seit, CURRENT_TIMESTAMP)
WHERE faelligkeitsdatum <= CURRENT_DATE AND ist_faellig = false;