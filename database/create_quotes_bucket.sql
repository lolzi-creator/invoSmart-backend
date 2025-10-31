-- Create quotes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mimes)
VALUES (
  'quotes',
  'quotes',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the quotes bucket
-- Allow authenticated users to upload their own company's quotes
CREATE POLICY IF NOT EXISTS "Users can upload to their own company folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotes' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM auth.users WHERE id = auth.uid())
);

-- Allow authenticated users to read their own company's quotes
CREATE POLICY IF NOT EXISTS "Users can read their own company quotes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotes' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM auth.users WHERE id = auth.uid())
);

-- Allow authenticated users to delete their own company's quotes
CREATE POLICY IF NOT EXISTS "Users can delete their own company quotes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quotes' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM auth.users WHERE id = auth.uid())
);

