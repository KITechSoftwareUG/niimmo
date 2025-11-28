-- Function to update kaution_ist when a payment is categorized as Mietkaution
CREATE OR REPLACE FUNCTION update_kaution_ist()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the payment is categorized as Mietkaution and has a mietvertrag_id
  IF NEW.kategorie = 'Mietkaution' AND NEW.mietvertrag_id IS NOT NULL THEN
    -- Calculate the total sum of all Mietkaution payments for this contract
    UPDATE mietvertrag
    SET kaution_ist = COALESCE((
      SELECT SUM(betrag)
      FROM zahlungen
      WHERE mietvertrag_id = NEW.mietvertrag_id
        AND kategorie = 'Mietkaution'
    ), 0)
    WHERE id = NEW.mietvertrag_id;
  END IF;
  
  -- If the payment was reassigned from one contract to another, update the old contract too
  IF TG_OP = 'UPDATE' AND OLD.mietvertrag_id IS NOT NULL AND OLD.mietvertrag_id != NEW.mietvertrag_id THEN
    UPDATE mietvertrag
    SET kaution_ist = COALESCE((
      SELECT SUM(betrag)
      FROM zahlungen
      WHERE mietvertrag_id = OLD.mietvertrag_id
        AND kategorie = 'Mietkaution'
    ), 0)
    WHERE id = OLD.mietvertrag_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT and UPDATE on zahlungen table
DROP TRIGGER IF EXISTS trigger_update_kaution_ist ON zahlungen;
CREATE TRIGGER trigger_update_kaution_ist
  AFTER INSERT OR UPDATE OF mietvertrag_id, kategorie, betrag ON zahlungen
  FOR EACH ROW
  EXECUTE FUNCTION update_kaution_ist();

-- Initial calculation: Update all existing kaution_ist values based on existing Mietkaution payments
UPDATE mietvertrag m
SET kaution_ist = COALESCE((
  SELECT SUM(z.betrag)
  FROM zahlungen z
  WHERE z.mietvertrag_id = m.id
    AND z.kategorie = 'Mietkaution'
), 0);
