-- Team logo uploads: public bucket, writes restricted to team
-- captain/creator via folder convention "team-logos/<team_id>/...".

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read team logos" ON storage.objects;
CREATE POLICY "Public read team logos" ON storage.objects
FOR SELECT USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Team stakeholders upload logos" ON storage.objects;
CREATE POLICY "Team stakeholders upload logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.captain_id = auth.uid() OR t.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Team stakeholders update logos" ON storage.objects;
CREATE POLICY "Team stakeholders update logos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.captain_id = auth.uid() OR t.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Team stakeholders delete logos" ON storage.objects;
CREATE POLICY "Team stakeholders delete logos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.captain_id = auth.uid() OR t.created_by = auth.uid())
  )
);
