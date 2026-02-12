
-- Add utility configuration columns to immobilien
ALTER TABLE public.immobilien
  ADD COLUMN hat_strom boolean NOT NULL DEFAULT true,
  ADD COLUMN hat_gas boolean NOT NULL DEFAULT true,
  ADD COLUMN hat_wasser boolean NOT NULL DEFAULT true;
