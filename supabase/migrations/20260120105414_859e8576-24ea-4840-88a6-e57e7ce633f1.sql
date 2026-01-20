-- Add lastschrift_bestaetigt_am to zahlungen table
-- NULL = payment is still in waiting period (unconfirmed)
-- Timestamp = payment has been confirmed after waiting period
ALTER TABLE public.zahlungen 
ADD COLUMN lastschrift_bestaetigt_am TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add lastschrift_wartetage to mietvertrag table
-- Default 4 days waiting period for direct debit confirmation
ALTER TABLE public.mietvertrag 
ADD COLUMN lastschrift_wartetage INTEGER DEFAULT 4;

-- Add comment for documentation
COMMENT ON COLUMN public.zahlungen.lastschrift_bestaetigt_am IS 'Timestamp when direct debit payment was confirmed after waiting period. NULL means still unconfirmed.';
COMMENT ON COLUMN public.mietvertrag.lastschrift_wartetage IS 'Number of days to wait before confirming direct debit payments. Default 4 days.';