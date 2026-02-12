
-- Versorger-Kontaktdaten für Immobilien
ALTER TABLE public.immobilien
  ADD COLUMN versorger_strom_email TEXT,
  ADD COLUMN versorger_gas_email TEXT,
  ADD COLUMN versorger_wasser_email TEXT;
