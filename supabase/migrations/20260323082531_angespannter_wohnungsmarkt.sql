-- Feature 9: Angespannter Wohnungsmarkt
-- Kappungsgrenze: 15% in 36 Monaten (angespannt) vs 20% (normal)
ALTER TABLE public.immobilien ADD COLUMN IF NOT EXISTS ist_angespannt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.immobilien.ist_angespannt IS 'Liegt die Immobilie in einem angespannten Wohnungsmarkt? Kappungsgrenze 15% statt 20% in 36 Monaten.';
