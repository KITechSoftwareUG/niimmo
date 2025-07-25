-- Remove the rolle column from mietvertrag_mieter table as it's no longer needed
ALTER TABLE public.mietvertrag_mieter 
DROP COLUMN IF EXISTS rolle;

-- Remove the Hinweis column as well if it exists (seems unused)
ALTER TABLE public.mietvertrag_mieter 
DROP COLUMN IF EXISTS Hinweis;