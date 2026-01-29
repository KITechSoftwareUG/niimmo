-- Add anzahl_personen column to mietvertrag table for per-contract person count
ALTER TABLE public.mietvertrag 
ADD COLUMN IF NOT EXISTS anzahl_personen integer DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.mietvertrag.anzahl_personen IS 'Anzahl der Personen im Haushalt für Nebenkostenabrechnung';