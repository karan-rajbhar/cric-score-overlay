-- Migration: 20260920010000_club_memberships_rls.sql
-- Fixes RLS policies on club_memberships and club_invitations:
-- 1. Updates is_club_member to recognize the club owner
-- 2. Allows authenticated users to join public clubs (insert role='member', status='active')
-- 3. Allows club owners to insert their initial owner membership
-- 4. Allows users with pending invitations to join
-- 5. Allows authenticated users to leave clubs (delete their own non-owner membership)
-- 6. Allows anyone to view memberships for public clubs
-- 7. Adds complete RLS policies for club_invitations

-- 1. Update is_club_member function to recognize owner
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = p_club_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id 
    AND user_id = p_user_id 
    AND status = 'active'
  );
$$;

-- 2. SELECT policies on club_memberships
DROP POLICY IF EXISTS "Anyone can view memberships of public clubs" ON public.club_memberships;
CREATE POLICY "Anyone can view memberships of public clubs" ON public.club_memberships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND (c.is_public = true OR c.is_public IS NULL)
  )
);

-- 3. INSERT policies on club_memberships
DROP POLICY IF EXISTS "Club admins can insert memberships" ON public.club_memberships;
CREATE POLICY "Club admins can insert memberships" ON public.club_memberships
FOR INSERT TO authenticated
WITH CHECK (
  public.is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Users can join public clubs" ON public.club_memberships;
CREATE POLICY "Users can join public clubs" ON public.club_memberships
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'member'
  AND status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND (c.is_public = true OR c.is_public IS NULL)
  )
);

DROP POLICY IF EXISTS "Club owners can insert owner membership" ON public.club_memberships;
CREATE POLICY "Club owners can insert owner membership" ON public.club_memberships
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'owner'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND c.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can join via invitation" ON public.club_memberships;
CREATE POLICY "Users can join via invitation" ON public.club_memberships
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'member'
  AND status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.club_invitations ci
    WHERE ci.club_id = club_id
    AND (ci.user_id = auth.uid() OR ci.email = (auth.jwt()->>'email'))
    AND ci.status = 'pending'
  )
);

-- 4. UPDATE policies on club_memberships
DROP POLICY IF EXISTS "Users can reactivate own membership in public clubs" ON public.club_memberships;
CREATE POLICY "Users can reactivate own membership in public clubs" ON public.club_memberships
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
  AND role = 'member'
  AND status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND (c.is_public = true OR c.is_public IS NULL)
  )
);

-- 5. DELETE policies on club_memberships
DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_memberships;
CREATE POLICY "Users can leave clubs" ON public.club_memberships
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND c.owner_id = auth.uid()
  )
);

-- 6. RLS policies on club_invitations
DROP POLICY IF EXISTS "Club admins and invitees can view invitations" ON public.club_invitations;
CREATE POLICY "Club admins and invitees can view invitations" ON public.club_invitations
FOR SELECT TO authenticated
USING (
  public.is_club_admin(club_id)
  OR email = (auth.jwt()->>'email')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Club admins can insert invitations" ON public.club_invitations;
CREATE POLICY "Club admins can insert invitations" ON public.club_invitations
FOR INSERT TO authenticated
WITH CHECK (
  public.is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admins and invitees can update invitations" ON public.club_invitations;
CREATE POLICY "Club admins and invitees can update invitations" ON public.club_invitations
FOR UPDATE TO authenticated
USING (
  public.is_club_admin(club_id)
  OR email = (auth.jwt()->>'email')
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_club_admin(club_id)
  OR email = (auth.jwt()->>'email')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Club admins can delete invitations" ON public.club_invitations;
CREATE POLICY "Club admins can delete invitations" ON public.club_invitations
FOR DELETE TO authenticated
USING (
  public.is_club_admin(club_id)
);

-- 7. Ensure permissions granted to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_invitations TO authenticated;
