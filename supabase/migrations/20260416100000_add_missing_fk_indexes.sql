-- Fehlende FK-Indexes für häufig verwendete Join- und Filter-Spalten
-- Diese Indexes sind kritisch für die Performance der Rückstands- und Zahlungsabfragen

CREATE INDEX IF NOT EXISTS idx_zahlungen_mietvertrag_id
  ON public.zahlungen(mietvertrag_id);

CREATE INDEX IF NOT EXISTS idx_mietforderungen_mietvertrag_id
  ON public.mietforderungen(mietvertrag_id);

CREATE INDEX IF NOT EXISTS idx_einheiten_immobilie_id
  ON public.einheiten(immobilie_id);

CREATE INDEX IF NOT EXISTS idx_mietvertrag_einheit_id
  ON public.mietvertrag(einheit_id);

CREATE INDEX IF NOT EXISTS idx_mietvertrag_mieter_mietvertrag_id
  ON public.mietvertrag_mieter(mietvertrag_id);
