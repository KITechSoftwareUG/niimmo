-- Allow public access to download documents
-- Update the SELECT policy to allow public (anonymous) users to download

DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- Create new policy that allows both authenticated and anonymous users to download
CREATE POLICY "Public can view documents" 
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'dokumente');