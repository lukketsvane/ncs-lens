-- Create storage bucket for scanned images
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload their own scans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own images
CREATE POLICY "Users can view their own scans"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access to read scans (for community feature)
CREATE POLICY "Public can view all scans"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'scans');

-- Allow users to delete their own scans
CREATE POLICY "Users can delete their own scans"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
