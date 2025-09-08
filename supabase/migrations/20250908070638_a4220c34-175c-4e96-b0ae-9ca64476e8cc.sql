-- Add meter numbers to einheiten table
ALTER TABLE public.einheiten 
ADD COLUMN kaltwasser_zaehler TEXT,
ADD COLUMN warmwasser_zaehler TEXT,
ADD COLUMN strom_zaehler TEXT,
ADD COLUMN gas_zaehler TEXT;

-- Add meter readings to mietvertrag table (move-in and move-out)
ALTER TABLE public.mietvertrag
ADD COLUMN kaltwasser_einzug NUMERIC,
ADD COLUMN warmwasser_einzug NUMERIC,
ADD COLUMN strom_einzug NUMERIC,
ADD COLUMN gas_einzug NUMERIC,
ADD COLUMN kaltwasser_auszug NUMERIC,
ADD COLUMN warmwasser_auszug NUMERIC,
ADD COLUMN strom_auszug NUMERIC,
ADD COLUMN gas_auszug NUMERIC;