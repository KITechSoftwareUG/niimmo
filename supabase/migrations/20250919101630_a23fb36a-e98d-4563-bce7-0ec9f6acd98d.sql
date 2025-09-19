-- Add missing kaution_status column to mietvertrag table
ALTER TABLE public.mietvertrag 
ADD COLUMN kaution_status text DEFAULT 'offen' CHECK (kaution_status IN ('offen', 'gezahlt'));

-- Update existing records based on kaution_gezahlt_am
UPDATE public.mietvertrag 
SET kaution_status = CASE 
  WHEN kaution_gezahlt_am IS NOT NULL THEN 'gezahlt'
  ELSE 'offen'
END;

-- Create index for better performance
CREATE INDEX idx_mietvertrag_kaution_status ON public.mietvertrag(kaution_status);