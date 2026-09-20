-- Club assets storage (logo and banner)
-- Public read access; write/update/delete restricted to club owners and active admins.

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-assets', 'club-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read club assets" ON storage.objects;
CREATE POLICY "Public read club assets" ON storage.objects
FOR SELECT USING (bucket_id = 'club-assets');

DROP POLICY IF EXISTS "Club stakeholders upload assets" ON storage.objects;
CREATE POLICY "Club stakeholders upload assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'club-assets'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    LEFT JOIN public.club_memberships cm ON cm.club_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.owner_id = auth.uid() OR cm.role = 'admin')
  )
);

DROP POLICY IF EXISTS "Club stakeholders update assets" ON storage.objects;
CREATE POLICY "Club stakeholders update assets" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'club-assets'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    LEFT JOIN public.club_memberships cm ON cm.club_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.owner_id = auth.uid() OR cm.role = 'admin')
  )
);

DROP POLICY IF EXISTS "Club stakeholders delete assets" ON storage.objects;
CREATE POLICY "Club stakeholders delete assets" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'club-assets'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    LEFT JOIN public.club_memberships cm ON cm.club_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.owner_id = auth.uid() OR cm.role = 'admin')
  )
);
