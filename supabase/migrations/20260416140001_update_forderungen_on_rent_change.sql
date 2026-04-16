-- Trigger: aktualisiert zukünftige Mietforderungen wenn Kaltmiete oder Betriebskosten geändert wird
-- Nur Forderungen ab dem aktuellen Monat werden aktualisiert (vergangene Forderungen bleiben)
-- Nur Forderungen die noch dem alten Vertragsbetrag entsprechen (nicht manuell überschriebene)

CREATE OR REPLACE FUNCTION public.update_forderungen_on_rent_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur wenn sich kaltmiete oder betriebskosten tatsächlich geändert hat
  IF OLD.kaltmiete IS DISTINCT FROM NEW.kaltmiete
     OR OLD.betriebskosten IS DISTINCT FROM NEW.betriebskosten THEN
    UPDATE public.mietforderungen
    SET sollbetrag = COALESCE(NEW.kaltmiete, 0) + COALESCE(NEW.betriebskosten, 0)
    WHERE mietvertrag_id = NEW.id
      AND sollmonat >= TO_CHAR(CURRENT_DATE, 'YYYY-MM')
      AND sollbetrag = COALESCE(OLD.kaltmiete, 0) + COALESCE(OLD.betriebskosten, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger auf mietvertrag nach UPDATE
DROP TRIGGER IF EXISTS trigger_update_forderungen_on_rent_change ON public.mietvertrag;
CREATE TRIGGER trigger_update_forderungen_on_rent_change
  AFTER UPDATE ON public.mietvertrag
  FOR EACH ROW
  EXECUTE FUNCTION public.update_forderungen_on_rent_change();
