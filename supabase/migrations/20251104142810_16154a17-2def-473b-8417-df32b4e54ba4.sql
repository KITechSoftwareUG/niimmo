-- Add immobilie_id column to zahlungen table to allow assigning payments to properties
ALTER TABLE zahlungen 
ADD COLUMN immobilie_id uuid REFERENCES immobilien(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_zahlungen_immobilie_id ON zahlungen(immobilie_id);

-- Add comment to document the column purpose
COMMENT ON COLUMN zahlungen.immobilie_id IS 'Optional reference to property (Immobilie) for payments that are assigned to a property rather than a specific contract';