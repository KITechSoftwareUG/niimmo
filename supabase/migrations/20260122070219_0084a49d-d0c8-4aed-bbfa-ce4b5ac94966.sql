-- Create table to cache AI classification results
CREATE TABLE public.nebenkosten_klassifizierungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zahlung_id UUID NOT NULL UNIQUE REFERENCES public.zahlungen(id) ON DELETE CASCADE,
  is_betriebskosten BOOLEAN NOT NULL DEFAULT true,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  category TEXT NOT NULL,
  suggested_immobilie_id UUID REFERENCES public.immobilien(id) ON DELETE SET NULL,
  reasoning TEXT,
  klassifiziert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bestaetigt BOOLEAN NOT NULL DEFAULT false,
  bestaetigt_am TIMESTAMP WITH TIME ZONE,
  uebersprungen BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.nebenkosten_klassifizierungen ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Only admin can access nebenkosten_klassifizierungen"
ON public.nebenkosten_klassifizierungen
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_nebenkosten_klassifizierungen_zahlung ON public.nebenkosten_klassifizierungen(zahlung_id);
CREATE INDEX idx_nebenkosten_klassifizierungen_bestaetigt ON public.nebenkosten_klassifizierungen(bestaetigt) WHERE bestaetigt = false;