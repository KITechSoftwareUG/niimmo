-- Add distribution key fields to einheiten table for operating cost allocation
ALTER TABLE einheiten 
ADD COLUMN IF NOT EXISTS verteilerschluessel_art text DEFAULT 'qm' CHECK (verteilerschluessel_art IN ('qm', 'personen', 'gleich', 'individuell')),
ADD COLUMN IF NOT EXISTS verteilerschluessel_wert numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anzahl_personen integer DEFAULT 1;

COMMENT ON COLUMN einheiten.verteilerschluessel_art IS 'Verteilungsart für Betriebskosten: qm, personen, gleich, individuell';
COMMENT ON COLUMN einheiten.verteilerschluessel_wert IS 'Individueller Prozentsatz bei verteilerschluessel_art=individuell';
COMMENT ON COLUMN einheiten.anzahl_personen IS 'Anzahl der Personen in der Einheit für Verteilung nach Personen';