-- Add Kaufpreis and Restschuld fields to immobilien table
ALTER TABLE public.immobilien 
ADD COLUMN kaufpreis NUMERIC,
ADD COLUMN restschuld NUMERIC;