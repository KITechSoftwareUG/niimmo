
ALTER TABLE public.immobilien
  ADD COLUMN IF NOT EXISTS versorger_strom_name text,
  ADD COLUMN IF NOT EXISTS versorger_gas_name text,
  ADD COLUMN IF NOT EXISTS versorger_wasser_name text;
