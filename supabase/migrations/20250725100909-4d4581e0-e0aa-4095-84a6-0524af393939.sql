-- Add back the rolle column to mietvertrag_mieter table
ALTER TABLE public.mietvertrag_mieter 
ADD COLUMN rolle text DEFAULT 'Hauptmieter';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_mietvertrag_mieter_rolle ON public.mietvertrag_mieter(rolle);

-- Add a Hinweis column if it doesn't exist (seems to be referenced in code)
ALTER TABLE public.mietvertrag_mieter 
ADD COLUMN Hinweis text;