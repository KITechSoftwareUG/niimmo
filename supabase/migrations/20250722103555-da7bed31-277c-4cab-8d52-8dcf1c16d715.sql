-- Füge lastschrift Spalte zur mietvertrag Tabelle hinzu
ALTER TABLE public.mietvertrag 
ADD COLUMN lastschrift boolean NOT NULL DEFAULT false;