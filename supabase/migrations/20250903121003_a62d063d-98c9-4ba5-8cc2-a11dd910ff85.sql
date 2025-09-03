-- Remove unnecessary columns and add kaution_ist column
ALTER TABLE mietvertrag DROP COLUMN IF EXISTS kaution_status;
ALTER TABLE mietvertrag DROP COLUMN IF EXISTS "2025 voll";

-- Add new column for IST-Kaution
ALTER TABLE mietvertrag ADD COLUMN kaution_ist NUMERIC DEFAULT 0.00;

-- Populate kaution_ist with current sum of Mietkaution payments
UPDATE mietvertrag 
SET kaution_ist = (
  SELECT COALESCE(SUM(z.betrag), 0)
  FROM zahlungen z 
  WHERE z.mietvertrag_id = mietvertrag.id 
  AND z.kategorie = 'Mietkaution'
);