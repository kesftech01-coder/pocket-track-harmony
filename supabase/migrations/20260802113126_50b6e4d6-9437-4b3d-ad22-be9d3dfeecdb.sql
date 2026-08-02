CREATE POLICY "Users can read their own files in my-backet-larry"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'my-backet-larry' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files in my-backet-larry"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'my-backet-larry' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own files in my-backet-larry"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'my-backet-larry' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'my-backet-larry' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files in my-backet-larry"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'my-backet-larry' AND auth.uid()::text = (storage.foldername(name))[1]);