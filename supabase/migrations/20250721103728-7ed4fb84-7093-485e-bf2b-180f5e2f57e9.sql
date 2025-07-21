-- Füge Telefonnummer und Geburtsdatum zu mieter Tabelle hinzu
ALTER TABLE public.mieter 
ADD COLUMN telnr TEXT,
ADD COLUMN geburtsdatum DATE;