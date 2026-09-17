-- Migration: 20260917010000_sync_auth_users_and_cascade_profile.sql
-- Description:
-- 1. Ensure all foreign key constraints referencing public.users(id) have ON UPDATE CASCADE.
-- 2. Upgrade public.ensure_own_profile() to handle existing emails/phones (e.g. from seed data or invites)
--    by re-mapping the record to the authenticated auth.uid() instead of failing unique constraints.
-- 3. Add public.handle_new_user() trigger on auth.users for automatic background syncing on signup.
-- 4. Re-sync any existing auth.users into public.users.

-- 1. UPGRADE ALL FOREIGN KEYS REFERENCING public.users(id) TO ON UPDATE CASCADE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT 
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND rc.unique_constraint_name IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY'
      )
      AND tc.table_schema = 'public'
  ) LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE %s',
      r.table_schema, r.table_name, r.constraint_name, r.constraint_name, r.column_name, r.delete_rule
    );
  END LOOP;
END $$;

-- 2. ENHANCED ensure_own_profile() WITH EMAIL/PHONE RE-MAPPING
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_claim JSONB := COALESCE(
    NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb,
    '{}'::jsonb
  );
  v_meta JSONB := COALESCE(v_claim->'raw_user_meta_data', '{}'::jsonb);
  v_email TEXT := NULLIF(LOWER(v_claim->>'email'), '');
  v_phone TEXT := NULLIF(v_claim->>'phone', '');
  v_full_name TEXT := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(v_meta->>'name', ''),
    COALESCE(v_email, v_phone, 'Player')
  );
  v_avatar_url TEXT := NULLIF(v_meta->>'avatar_url', '');
  v_existing_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Step A: Check if public.users already has this exact auth UUID
  SELECT id INTO v_existing_id FROM public.users WHERE id = v_uid;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.users
    SET 
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_uid;

    RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'action', 'updated');
  END IF;

  -- Step B: Check if a public.users record exists with the same email or phone (e.g. from seed or invite)
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.users WHERE LOWER(email) = v_email LIMIT 1;
  END IF;

  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.users WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing row to match auth UUID. ON UPDATE CASCADE will propagate to all FKs.
    UPDATE public.users
    SET 
      id = v_uid,
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'action', 'remapped');
  END IF;

  -- Step C: Insert fresh user record
  IF v_email IS NULL AND v_phone IS NULL THEN
    v_email := 'player-' || left(v_uid::text, 8) || '@players.local';
  END IF;

  INSERT INTO public.users (id, email, phone, full_name, avatar_url)
  VALUES (
    v_uid,
    v_email,
    v_phone,
    v_full_name,
    v_avatar_url
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'action', 'created');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

-- 3. AUTOMATIC AUTH TRIGGER ON auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_email TEXT := NULLIF(LOWER(NEW.email), '');
  v_phone TEXT := NULLIF(NEW.phone, '');
  v_full_name TEXT := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(v_meta->>'name', ''),
    COALESCE(v_email, v_phone, 'Player')
  );
  v_avatar_url TEXT := NULLIF(v_meta->>'avatar_url', '');
  v_existing_id UUID;
BEGIN
  -- Check if user already exists by ID
  SELECT id INTO v_existing_id FROM public.users WHERE id = NEW.id;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.users
    SET
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Check if user exists by email/phone
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.users WHERE LOWER(email) = v_email LIMIT 1;
  END IF;
  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.users WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.users
    SET
      id = NEW.id,
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- Insert fresh
  IF v_email IS NULL AND v_phone IS NULL THEN
    v_email := 'player-' || left(NEW.id::text, 8) || '@players.local';
  END IF;

  INSERT INTO public.users (id, email, phone, full_name, avatar_url)
  VALUES (NEW.id, v_email, v_phone, v_full_name, v_avatar_url)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. IMMEDIATE SYNC OF EXISTING auth.users INTO public.users
DO $$
DECLARE
  u RECORD;
  v_existing_id UUID;
  v_meta JSONB;
  v_email TEXT;
  v_phone TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
BEGIN
  FOR u IN SELECT * FROM auth.users LOOP
    v_meta := COALESCE(u.raw_user_meta_data, '{}'::jsonb);
    v_email := NULLIF(LOWER(u.email), '');
    v_phone := NULLIF(u.phone, '');
    v_full_name := COALESCE(
      NULLIF(v_meta->>'full_name', ''),
      NULLIF(v_meta->>'name', ''),
      COALESCE(v_email, v_phone, 'Player')
    );
    v_avatar_url := NULLIF(v_meta->>'avatar_url', '');

    -- Check if already present by id
    SELECT id INTO v_existing_id FROM public.users WHERE id = u.id;
    IF v_existing_id IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Check if present by email
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.users WHERE LOWER(email) = v_email LIMIT 1;
    END IF;
    IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.users WHERE phone = v_phone LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.users
      SET id = u.id,
          email = COALESCE(v_email, email),
          phone = COALESCE(v_phone, phone),
          full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
          avatar_url = COALESCE(v_avatar_url, avatar_url),
          updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.users (id, email, phone, full_name, avatar_url)
      VALUES (u.id, COALESCE(v_email, 'player-' || left(u.id::text, 8) || '@players.local'), v_phone, v_full_name, v_avatar_url)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
