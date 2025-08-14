-- Fix storage policies for document downloads
-- The bucket is private, so we need to ensure authenticated users can download

-- Drop existing policies to recreate them with proper authentication
DROP POLICY IF EXISTS "Users can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;

-- Create new policies that work with authenticated users
CREATE POLICY "Authenticated users can view documents" 
ON storage.objects FOR SELECT 
TO authenticated
USING (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can update documents" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'dokumente');