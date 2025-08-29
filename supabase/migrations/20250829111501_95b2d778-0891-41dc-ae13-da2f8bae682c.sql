-- Fix search path for the functions I just created
DROP FUNCTION IF EXISTS public.calculate_zugeordneter_monat(DATE);
DROP FUNCTION IF EXISTS public.set_zugeordneter_monat_trigger();

-- Recreate functions with secure search path
CREATE OR REPLACE FUNCTION public.calculate_zugeordneter_monat(buchungsdatum DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If payment is on 28th, 29th, 30th, or 31st of month, assign to next month
  IF EXTRACT(DAY FROM buchungsdatum) >= 28 THEN
    RETURN TO_CHAR(buchungsdatum + INTERVAL '1 month', 'YYYY-MM');
  ELSE
    -- Otherwise assign to the month of payment
    RETURN TO_CHAR(buchungsdatum, 'YYYY-MM');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_zugeordneter_monat_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only auto-calculate if zugeordneter_monat is not explicitly set
  IF NEW.zugeordneter_monat IS NULL THEN
    NEW.zugeordneter_monat := calculate_zugeordneter_monat(NEW.buchungsdatum);
  END IF;
  
  RETURN NEW;
END;
$$;