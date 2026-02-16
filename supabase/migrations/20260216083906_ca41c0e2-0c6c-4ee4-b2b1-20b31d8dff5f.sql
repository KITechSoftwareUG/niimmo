-- Aktiviere zweite Hausanschlusszähler für Objekt 6 Schellerten
UPDATE public.immobilien 
SET 
  allgemein_strom_zaehler_2 = '',
  allgemein_gas_zaehler_2 = '',
  allgemein_wasser_zaehler_2 = ''
WHERE id = '00000000-0000-0000-0000-000000000006';