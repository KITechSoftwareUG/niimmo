-- Add neue_anschrift column to mietvertrag table for terminated/ended contracts
ALTER TABLE public.mietvertrag 
ADD COLUMN neue_anschrift text;