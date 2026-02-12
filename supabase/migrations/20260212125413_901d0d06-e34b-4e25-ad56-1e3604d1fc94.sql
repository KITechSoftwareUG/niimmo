
-- Zweiter Satz Hausanschlusszähler für Sonderfälle wie Gehrden
ALTER TABLE public.immobilien
ADD COLUMN allgemein_strom_zaehler_2 TEXT,
ADD COLUMN allgemein_strom_stand_2 NUMERIC,
ADD COLUMN allgemein_strom_datum_2 DATE,
ADD COLUMN allgemein_gas_zaehler_2 TEXT,
ADD COLUMN allgemein_gas_stand_2 NUMERIC,
ADD COLUMN allgemein_gas_datum_2 DATE,
ADD COLUMN allgemein_wasser_zaehler_2 TEXT,
ADD COLUMN allgemein_wasser_stand_2 NUMERIC,
ADD COLUMN allgemein_wasser_datum_2 DATE;
