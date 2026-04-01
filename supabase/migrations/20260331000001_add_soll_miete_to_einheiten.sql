-- Add soll_miete column to einheiten table
-- Stores the target/nominal rent amount for a unit (nullable)

ALTER TABLE einheiten ADD COLUMN IF NOT EXISTS soll_miete numeric;
