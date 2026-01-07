-- Füge aktuelle Zählerstände zur Einheiten-Tabelle hinzu (mit Datum)
ALTER TABLE public.einheiten 
ADD COLUMN IF NOT EXISTS kaltwasser_stand_aktuell numeric,
ADD COLUMN IF NOT EXISTS kaltwasser_stand_datum date,
ADD COLUMN IF NOT EXISTS warmwasser_stand_aktuell numeric,
ADD COLUMN IF NOT EXISTS warmwasser_stand_datum date,
ADD COLUMN IF NOT EXISTS strom_stand_aktuell numeric,
ADD COLUMN IF NOT EXISTS strom_stand_datum date,
ADD COLUMN IF NOT EXISTS gas_stand_aktuell numeric,
ADD COLUMN IF NOT EXISTS gas_stand_datum date;