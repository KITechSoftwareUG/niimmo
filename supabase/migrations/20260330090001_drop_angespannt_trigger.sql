-- Automatischen Trigger entfernen — ist_angespannt wird manuell gesetzt
-- (User-Entscheidung: rein manuell per Checkbox in der Immobilien-Detailansicht)
DROP TRIGGER IF EXISTS trg_check_angespannter_markt ON public.immobilien;
DROP FUNCTION IF EXISTS public.check_angespannter_markt();
