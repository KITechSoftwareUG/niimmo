-- Feature 13: Darlehen Auto-Matching - Referenz zur Original-Zahlung
-- Ermoeglicht das Verknuepfen von Bankzahlungen mit Darlehens-Zahlungen
ALTER TABLE public.darlehen_zahlungen
  ADD COLUMN IF NOT EXISTS zahlung_ref_id UUID REFERENCES public.zahlungen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_darlehen_zahlungen_ref ON public.darlehen_zahlungen(zahlung_ref_id);
