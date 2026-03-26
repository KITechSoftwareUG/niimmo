-- ============================================================
-- Trigger: ist_angespannt automatisch setzen
-- Prueft bei INSERT/UPDATE ob die Stadt der Immobilie
-- in der angespannte_maerkte Tabelle vorkommt
-- ============================================================

-- Sicherstellen dass die Spalte existiert (falls fruehere Migration nicht lief)
ALTER TABLE public.immobilien ADD COLUMN IF NOT EXISTS ist_angespannt BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_angespannter_markt()
RETURNS TRIGGER AS $$
DECLARE
  stadt_name TEXT;
  ist_angespannt_result BOOLEAN;
BEGIN
  -- Stadt aus der Adresse extrahieren (letztes Wort nach PLZ)
  -- Typisches Format: "Musterstr. 1, 31319 Sehnde" oder "Egestorffstr. 11, 30169 Hannover"
  stadt_name := regexp_replace(NEW.adresse, '.*\d{5}\s+', '');
  stadt_name := trim(stadt_name);

  -- Pruefe ob die Stadt in der Lookup-Tabelle ist
  SELECT EXISTS (
    SELECT 1 FROM public.angespannte_maerkte
    WHERE gemeinde = stadt_name
      AND bundesland = 'Niedersachsen'
      AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
  ) INTO ist_angespannt_result;

  NEW.ist_angespannt := ist_angespannt_result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger bei INSERT und UPDATE auf immobilien
DROP TRIGGER IF EXISTS trg_check_angespannter_markt ON public.immobilien;
CREATE TRIGGER trg_check_angespannter_markt
  BEFORE INSERT OR UPDATE OF adresse ON public.immobilien
  FOR EACH ROW
  EXECUTE FUNCTION public.check_angespannter_markt();

-- Einmalig alle bestehenden Immobilien aktualisieren
UPDATE public.immobilien SET ist_angespannt = EXISTS (
  SELECT 1 FROM public.angespannte_maerkte am
  WHERE am.gemeinde = regexp_replace(immobilien.adresse, '.*\d{5}\s+', '')
    AND am.bundesland = 'Niedersachsen'
    AND (am.gueltig_bis IS NULL OR am.gueltig_bis >= CURRENT_DATE)
);
