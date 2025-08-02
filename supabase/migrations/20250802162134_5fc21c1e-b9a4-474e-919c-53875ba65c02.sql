-- Update the zahlkategorien enum to only have Miete and Nichtmiete
DROP TYPE IF EXISTS zahlkategorien CASCADE;
CREATE TYPE zahlkategorien AS ENUM ('Miete', 'Nichtmiete');

-- Recreate the kategorie column in zahlungen table
ALTER TABLE zahlungen DROP COLUMN IF EXISTS kategorie;
ALTER TABLE zahlungen ADD COLUMN kategorie zahlkategorien DEFAULT 'Miete';

-- Set all existing payments to 'Miete'
UPDATE zahlungen SET kategorie = 'Miete';