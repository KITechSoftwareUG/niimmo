-- Add month column to zahlungen table
ALTER TABLE public.zahlungen 
ADD COLUMN zugeordneter_monat TEXT;

-- Create function to automatically assign month based on payment date
CREATE OR REPLACE FUNCTION public.calculate_zugeordneter_monat(buchungsdatum DATE)
RETURNS TEXT AS $$
BEGIN
  -- If payment is on 28th, 29th, 30th, or 31st of month, assign to next month
  IF EXTRACT(DAY FROM buchungsdatum) >= 28 THEN
    RETURN TO_CHAR(buchungsdatum + INTERVAL '1 month', 'YYYY-MM');
  ELSE
    -- Otherwise assign to the month of payment
    RETURN TO_CHAR(buchungsdatum, 'YYYY-MM');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set zugeordneter_monat on insert/update
CREATE OR REPLACE FUNCTION public.set_zugeordneter_monat_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-calculate if zugeordneter_monat is not explicitly set
  IF NEW.zugeordneter_monat IS NULL THEN
    NEW.zugeordneter_monat := calculate_zugeordneter_monat(NEW.buchungsdatum);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_set_zugeordneter_monat
  BEFORE INSERT OR UPDATE ON public.zahlungen
  FOR EACH ROW
  EXECUTE FUNCTION public.set_zugeordneter_monat_trigger();

-- Update existing records
UPDATE public.zahlungen 
SET zugeordneter_monat = calculate_zugeordneter_monat(buchungsdatum)
WHERE zugeordneter_monat IS NULL;