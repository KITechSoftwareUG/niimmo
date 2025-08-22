-- Füge Mahnsystem zur mietvertrag Tabelle hinzu
ALTER TABLE public.mietvertrag 
ADD COLUMN mahnstufe integer DEFAULT 0 CHECK (mahnstufe >= 0 AND mahnstufe <= 3),
ADD COLUMN letzte_mahnung_am timestamp with time zone,
ADD COLUMN naechste_mahnung_am timestamp with time zone;