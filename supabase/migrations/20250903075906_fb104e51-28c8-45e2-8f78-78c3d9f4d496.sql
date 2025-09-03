-- Erweitere mietforderungen Tabelle um Fälligkeitslogik
ALTER TABLE public.mietforderungen 
ADD COLUMN faelligkeitsdatum date,
ADD COLUMN ist_faellig boolean DEFAULT false,
ADD COLUMN faellig_seit timestamp with time zone;

-- Aktualisiere bestehende Forderungen: Fälligkeitsdatum = 7 Tage nach Monatsende
UPDATE public.mietforderungen 
SET faelligkeitsdatum = (sollmonat || '-01')::date + INTERVAL '1 month' + INTERVAL '7 days'
WHERE faelligkeitsdatum IS NULL;

-- Setze bereits überfällige Forderungen auf fällig
UPDATE public.mietforderungen 
SET ist_faellig = true,
    faellig_seit = faelligkeitsdatum::timestamp with time zone
WHERE faelligkeitsdatum <= CURRENT_DATE 
AND ist_faellig = false;

-- Funktion um Forderungen auf fällig zu setzen
CREATE OR REPLACE FUNCTION public.update_faellige_forderungen()
RETURNS TABLE(
  forderung_id uuid,
  mietvertrag_id uuid,
  sollmonat text,
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

-- Trigger für neue Forderungen: Automatisch Fälligkeitsdatum setzen
CREATE OR REPLACE FUNCTION public.set_faelligkeitsdatum_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Setze Fälligkeitsdatum auf 7 Tage nach Monatsende
  IF NEW.faelligkeitsdatum IS NULL THEN
    NEW.faelligkeitsdatum := (NEW.sollmonat || '-01')::date + INTERVAL '1 month' + INTERVAL '7 days';
  END IF;
  
  -- Prüfe ob bereits fällig
  IF NEW.faelligkeitsdatum <= CURRENT_DATE THEN
    NEW.ist_faellig := true;
    NEW.faellig_seit := CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Erstelle Trigger
DROP TRIGGER IF EXISTS trigger_set_faelligkeitsdatum ON public.mietforderungen;
CREATE TRIGGER trigger_set_faelligkeitsdatum
  BEFORE INSERT OR UPDATE ON public.mietforderungen
  FOR EACH ROW
  EXECUTE FUNCTION public.set_faelligkeitsdatum_trigger();