-- Add Mietkaution category to zahlungskategorie enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Mietkaution' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'zahlungskategorie')) THEN
        ALTER TYPE zahlungskategorie ADD VALUE 'Mietkaution';
    END IF;
END$$;

-- Add deposit status fields to mietvertrag table
ALTER TABLE public.mietvertrag 
ADD COLUMN IF NOT EXISTS kaution_status TEXT DEFAULT 'offen',
ADD COLUMN IF NOT EXISTS kaution_gezahlt_am DATE;

-- Update existing contracts before 2025-01-01 to have paid deposit status
UPDATE public.mietvertrag 
SET 
    kaution_status = 'gezahlt',
    kaution_gezahlt_am = start_datum
WHERE start_datum < '2025-01-01'
AND kaution_status = 'offen';

-- Create function to automatically update deposit status when Mietkaution payment is added
CREATE OR REPLACE FUNCTION public.update_deposit_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process Mietkaution payments for contracts after 2025-01-01
    IF NEW.kategorie = 'Mietkaution' AND NEW.mietvertrag_id IS NOT NULL THEN
        -- Check if this is for a contract after 2025-01-01
        IF EXISTS (
            SELECT 1 FROM mietvertrag 
            WHERE id = NEW.mietvertrag_id 
            AND start_datum >= '2025-01-01'
        ) THEN
            -- Update the contract's deposit status
            UPDATE mietvertrag 
            SET 
                kaution_status = 'gezahlt',
                kaution_gezahlt_am = NEW.buchungsdatum
            WHERE id = NEW.mietvertrag_id
            AND kaution_status = 'offen';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update deposit status when payments are added
DROP TRIGGER IF EXISTS update_deposit_status_trigger ON zahlungen;
CREATE TRIGGER update_deposit_status_trigger
    AFTER INSERT ON zahlungen
    FOR EACH ROW
    EXECUTE FUNCTION update_deposit_status_on_payment();

-- Create function to handle deposit status updates when payments are deleted
CREATE OR REPLACE FUNCTION public.reset_deposit_status_on_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process Mietkaution payments for contracts after 2025-01-01
    IF OLD.kategorie = 'Mietkaution' AND OLD.mietvertrag_id IS NOT NULL THEN
        -- Check if this was for a contract after 2025-01-01
        IF EXISTS (
            SELECT 1 FROM mietvertrag 
            WHERE id = OLD.mietvertrag_id 
            AND start_datum >= '2025-01-01'
        ) THEN
            -- Check if there are any other Mietkaution payments for this contract
            IF NOT EXISTS (
                SELECT 1 FROM zahlungen 
                WHERE mietvertrag_id = OLD.mietvertrag_id 
                AND kategorie = 'Mietkaution'
                AND id != OLD.id
            ) THEN
                -- Reset deposit status to open
                UPDATE mietvertrag 
                SET 
                    kaution_status = 'offen',
                    kaution_gezahlt_am = NULL
                WHERE id = OLD.mietvertrag_id;
            END IF;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to reset deposit status when payments are deleted
DROP TRIGGER IF EXISTS reset_deposit_status_trigger ON zahlungen;
CREATE TRIGGER reset_deposit_status_trigger
    AFTER DELETE ON zahlungen
    FOR EACH ROW
    EXECUTE FUNCTION reset_deposit_status_on_payment_delete();