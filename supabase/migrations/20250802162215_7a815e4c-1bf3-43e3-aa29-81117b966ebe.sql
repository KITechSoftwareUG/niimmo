-- Enable RLS for zahlungen table and create policies
ALTER TABLE zahlungen ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later based on authentication needs)
CREATE POLICY "Allow all operations on zahlungen" 
ON zahlungen 
FOR ALL 
USING (true) 
WITH CHECK (true);