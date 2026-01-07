-- Add house connection meters (Hausanschlusszähler) to immobilien table
ALTER TABLE public.immobilien
ADD COLUMN allgemein_wasser_zaehler text,
ADD COLUMN allgemein_wasser_stand numeric,
ADD COLUMN allgemein_wasser_datum date,
ADD COLUMN allgemein_strom_zaehler text,
ADD COLUMN allgemein_strom_stand numeric,
ADD COLUMN allgemein_strom_datum date,
ADD COLUMN allgemein_gas_zaehler text,
ADD COLUMN allgemein_gas_stand numeric,
ADD COLUMN allgemein_gas_datum date;