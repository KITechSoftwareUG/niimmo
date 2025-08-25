-- Fix storage policies for the dokumente bucket
-- Remove the conflicting public policy and add proper authenticated policies

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;  
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- Create proper policies for private bucket access
CREATE POLICY "Authenticated users can view documents" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can download documents" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can update documents" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'dokumente');

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'dokumente');