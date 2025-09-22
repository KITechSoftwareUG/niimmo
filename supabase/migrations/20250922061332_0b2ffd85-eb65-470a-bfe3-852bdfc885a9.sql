-- Add field for Rücklastschrift fee in Mietvertrag
ALTER TABLE public.mietvertrag 
ADD COLUMN ruecklastschrift_gebuehr NUMERIC DEFAULT 7.50;

COMMENT ON COLUMN public.mietvertrag.ruecklastschrift_gebuehr IS 'Gebühr für Rücklastschrift in Euro (default 7.50)';

-- Function to create a Forderung when a Rücklastschrift occurs
CREATE OR REPLACE FUNCTION public.create_ruecklastschrift_forderung()
RETURNS TRIGGER AS $$
DECLARE
    contract_record RECORD;
    zugeordneter_monat_str TEXT;
BEGIN
    -- Only process if kategorie is 'Rücklastschrift' and mietvertrag_id is set
    IF NEW.kategorie = 'Rücklastschrift' AND NEW.mietvertrag_id IS NOT NULL THEN
        -- Get contract details
        SELECT * INTO contract_record 
        FROM mietvertrag 
        WHERE id = NEW.mietvertrag_id 
        AND lastschrift = true;
        
        -- Only proceed if contract exists and uses Lastschrift
        IF FOUND THEN
            -- Use zugeordneter_monat if available, otherwise calculate from buchungsdatum
            IF NEW.zugeordneter_monat IS NOT NULL THEN
                zugeordneter_monat_str := NEW.zugeordneter_monat;
            ELSE
                zugeordneter_monat_str := TO_CHAR(NEW.buchungsdatum, 'YYYY-MM');
            END IF;
            
            -- Create Forderung for Rücklastschrift fee
            INSERT INTO mietforderungen (
                mietvertrag_id,
                sollmonat,
                sollbetrag,
                ist_faellig,
                faelligkeitsdatum,
                faellig_seit
            ) VALUES (
                NEW.mietvertrag_id,
                zugeordneter_monat_str,
                COALESCE(contract_record.ruecklastschrift_gebuehr, 7.50),
                true, -- Immediately due
                NEW.buchungsdatum, -- Due on the date of Rücklastschrift
                CURRENT_TIMESTAMP
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic Forderung creation on Rücklastschrift
CREATE TRIGGER create_ruecklastschrift_forderung_trigger
    AFTER INSERT OR UPDATE ON zahlungen
    FOR EACH ROW
    EXECUTE FUNCTION create_ruecklastschrift_forderung();