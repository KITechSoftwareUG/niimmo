-- Add fee column for Rücklastschrift payments
ALTER TABLE zahlungen ADD COLUMN ruecklastschrift_gebuehr NUMERIC DEFAULT 0.00;