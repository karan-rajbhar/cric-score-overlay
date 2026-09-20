-- Migration: 20260920020000_unique_user_handles.sql
-- Description: Adds unique @username / handle support for all users, with auto-generation,
-- reserved words validation, format constraints, and backfilling existing users.

-- 1. ADD USERNAME COLUMN TO public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. UNIQUE CASE-INSENSITIVE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
  ON public.users (lower(username));

-- 3. USERNAME FORMAT CONSTRAINT (3-30 characters, lowercase alphanumeric and underscores, no leading/trailing underscores)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS valid_username;

ALTER TABLE public.users
  ADD CONSTRAINT valid_username
  CHECK (
    username IS NULL OR (
      username ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$'
      AND length(username) BETWEEN 3 AND 30
      AND username = lower(username)
    )
  );

-- 4. USERNAME GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION public.generate_unique_username(
  p_full_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_base TEXT;
  v_clean TEXT;
  v_candidate TEXT;
  v_counter INT := 0;
  v_reserved TEXT[] := ARRAY[
    'about', 'account', 'admin', 'administrator', 'api', 'app', 'auth',
    'billing', 'blog', 'bot', 'broadcast', 'club', 'clubs', 'contact',
    'cricscore', 'dashboard', 'dev', 'developer', 'docs', 'edit', 'explore',
    'faq', 'graphql', 'help', 'home', 'inbox', 'info', 'jobs', 'join',
    'legal', 'live', 'login', 'logout', 'match', 'matches', 'media',
    'message', 'moderator', 'news', 'notifications', 'official', 'overlay',
    'overview', 'player', 'players', 'privacy', 'profile', 'root', 'score',
    'search', 'security', 'settings', 'signin', 'signup', 'squad', 'squads',
    'status', 'stumps', 'super', 'support', 'system', 'team', 'teams',
    'terms', 'tournament', 'tournaments', 'user', 'users', 'verify'
  ];
BEGIN
  -- Prefer email username if provided and not generic
  IF p_email IS NOT NULL AND p_email NOT LIKE '%@players.local' AND p_email NOT LIKE '%@example.com' THEN
    v_base := split_part(p_email, '@', 1);
  END IF;

  -- Fallback to full name
  IF v_base IS NULL OR length(trim(v_base)) = 0 THEN
    v_base := COALESCE(p_full_name, 'player');
  END IF;

  -- Normalize: lowercase, replace spaces/symbols with underscore
  v_clean := lower(v_base);
  v_clean := regexp_replace(v_clean, '[^a-z0-9_]+', '_', 'g');
  v_clean := regexp_replace(v_clean, '^_+|_+$', '', 'g');
  v_clean := regexp_replace(v_clean, '_{2,}', '_', 'g');

  -- Ensure minimum length of 3
  IF length(v_clean) = 0 THEN
    v_clean := 'player';
  ELSIF length(v_clean) < 3 THEN
    v_clean := 'user_' || v_clean;
  END IF;

  -- Ensure starts and ends with alphanumeric
  IF v_clean ~ '^_' THEN
    v_clean := 'u' || v_clean;
  END IF;
  IF v_clean ~ '_$' THEN
    v_clean := v_clean || '0';
  END IF;

  -- Truncate base to max 22 chars to allow room for counter suffixes
  IF length(v_clean) > 22 THEN
    v_clean := substring(v_clean from 1 for 22);
    v_clean := regexp_replace(v_clean, '_+$', '');
    IF length(v_clean) < 3 THEN
      v_clean := 'player';
    END IF;
  END IF;

  -- Loop until candidate is not reserved and not already taken
  v_candidate := v_clean;
  WHILE (
    v_candidate = ANY(v_reserved)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE lower(username) = lower(v_candidate)
      AND (p_user_id IS NULL OR id != p_user_id)
    )
  ) LOOP
    v_counter := v_counter + 1;
    v_candidate := v_clean || '_' || v_counter::text;
    IF length(v_candidate) > 30 THEN
      v_candidate := substring(v_clean from 1 for (29 - length(v_counter::text))) || '_' || v_counter::text;
    END IF;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- 5. BACKFILL EXISTING USERS WITH UNIQUE HANDLES
DO $$
DECLARE
  r RECORD;
  v_handle TEXT;
BEGIN
  FOR r IN SELECT id, full_name, email FROM public.users WHERE username IS NULL ORDER BY created_at ASC LOOP
    v_handle := public.generate_unique_username(r.full_name, r.email, r.id);
    UPDATE public.users SET username = v_handle WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. RPC: CHECK USERNAME AVAILABILITY
CREATE OR REPLACE FUNCTION public.check_username_available(
  p_username TEXT,
  p_current_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_norm TEXT := lower(trim(COALESCE(p_username, '')));
  v_caller UUID := auth.uid();
  v_target_id UUID := COALESCE(p_current_user_id, v_caller);
  v_reserved TEXT[] := ARRAY[
    'about', 'account', 'admin', 'administrator', 'api', 'app', 'auth',
    'billing', 'blog', 'bot', 'broadcast', 'club', 'clubs', 'contact',
    'cricscore', 'dashboard', 'dev', 'developer', 'docs', 'edit', 'explore',
    'faq', 'graphql', 'help', 'home', 'inbox', 'info', 'jobs', 'join',
    'legal', 'live', 'login', 'logout', 'match', 'matches', 'media',
    'message', 'moderator', 'news', 'notifications', 'official', 'overlay',
    'overview', 'player', 'players', 'privacy', 'profile', 'root', 'score',
    'search', 'security', 'settings', 'signin', 'signup', 'squad', 'squads',
    'status', 'stumps', 'super', 'support', 'system', 'team', 'teams',
    'terms', 'tournament', 'tournaments', 'user', 'users', 'verify'
  ];
BEGIN
  IF length(v_norm) < 3 THEN
    RETURN jsonb_build_object('available', FALSE, 'error', 'Username must be at least 3 characters');
  END IF;

  IF length(v_norm) > 30 THEN
    RETURN jsonb_build_object('available', FALSE, 'error', 'Username cannot exceed 30 characters');
  END IF;

  IF NOT (v_norm ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$') THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'error', 'Username can only contain letters, numbers, and underscores, and cannot start or end with an underscore'
    );
  END IF;

  IF v_norm = ANY(v_reserved) THEN
    RETURN jsonb_build_object('available', FALSE, 'error', 'This username is reserved');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE lower(username) = v_norm
    AND (v_target_id IS NULL OR id != v_target_id)
  ) THEN
    RETURN jsonb_build_object('available', FALSE, 'error', 'This username is already taken');
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'username', v_norm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT, UUID) TO anon, authenticated, service_role;

-- 7. RPC: UPDATE OWN USERNAME
CREATE OR REPLACE FUNCTION public.update_own_username(
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_check JSONB;
  v_norm TEXT := lower(trim(COALESCE(p_username, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_check := public.check_username_available(v_norm, v_uid);
  IF NOT (v_check->>'available')::boolean THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', v_check->>'error');
  END IF;

  UPDATE public.users
  SET 
    username = v_norm,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', TRUE, 'username', v_norm);
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_username(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_username(TEXT) TO authenticated, service_role;

-- 8. UPDATE ensure_own_profile() TO POPULATE USERNAME
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS JSONB
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
  v_username TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Step A: Check if public.users already has this exact auth UUID
  SELECT id, username INTO v_existing_id, v_username FROM public.users WHERE id = v_uid;
  IF v_existing_id IS NOT NULL THEN
    IF v_username IS NULL THEN
      v_username := public.generate_unique_username(v_full_name, v_email, v_uid);
    END IF;

    UPDATE public.users
    SET 
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      username = COALESCE(username, v_username),
      updated_at = NOW()
    WHERE id = v_uid;

    RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'username', v_username, 'action', 'updated');
  END IF;

  -- Step B: Check if a public.users record exists with the same email or phone
  IF v_email IS NOT NULL THEN
    SELECT id, username INTO v_existing_id, v_username FROM public.users WHERE LOWER(email) = v_email LIMIT 1;
  END IF;

  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id, username INTO v_existing_id, v_username FROM public.users WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    IF v_username IS NULL THEN
      v_username := public.generate_unique_username(v_full_name, v_email, v_uid);
    END IF;

    UPDATE public.users
    SET 
      id = v_uid,
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      username = COALESCE(username, v_username),
      updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'username', v_username, 'action', 'remapped');
  END IF;

  -- Step C: Insert fresh user record
  IF v_email IS NULL AND v_phone IS NULL THEN
    v_email := 'player-' || left(v_uid::text, 8) || '@players.local';
  END IF;

  v_username := public.generate_unique_username(v_full_name, v_email, v_uid);

  INSERT INTO public.users (id, email, phone, full_name, avatar_url, username)
  VALUES (
    v_uid,
    v_email,
    v_phone,
    v_full_name,
    v_avatar_url,
    v_username
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid, 'username', v_username, 'action', 'created');
END;
$$;

-- 9. UPDATE handle_new_user() TRIGGER
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
  v_username TEXT;
BEGIN
  v_username := NULLIF(lower(trim(v_meta->>'username')), '');
  IF v_username IS NOT NULL THEN
    -- Verify validity or auto-generate if invalid/taken
    IF NOT (v_username ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$') OR EXISTS (SELECT 1 FROM public.users WHERE lower(username) = v_username AND id != NEW.id) THEN
      v_username := public.generate_unique_username(v_full_name, v_email, NEW.id);
    END IF;
  ELSE
    v_username := public.generate_unique_username(v_full_name, v_email, NEW.id);
  END IF;

  SELECT id INTO v_existing_id FROM public.users WHERE id = NEW.id;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.users
    SET
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      full_name = CASE WHEN full_name IS NULL OR full_name = 'Player' THEN v_full_name ELSE full_name END,
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      username = COALESCE(username, v_username),
      updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

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
      username = COALESCE(username, v_username),
      updated_at = NOW()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    v_email := 'player-' || left(NEW.id::text, 8) || '@players.local';
  END IF;

  INSERT INTO public.users (id, email, phone, full_name, avatar_url, username)
  VALUES (
    NEW.id,
    v_email,
    v_phone,
    v_full_name,
    v_avatar_url,
    v_username
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = COALESCE(public.users.username, EXCLUDED.username);

  RETURN NEW;
END;
$$;

-- 10. UPDATE create_team_player TO SET USERNAME FOR INLINE PLAYERS
DROP FUNCTION IF EXISTS public.create_team_player(UUID, TEXT, INT);
CREATE OR REPLACE FUNCTION public.create_team_player(
  p_team_id UUID,
  p_full_name TEXT,
  p_jersey_number INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller UUID := auth.uid();
  v_slug TEXT;
  v_username TEXT;
  v_is_team_admin BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Player name is required' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = p_team_id
      AND (
        t.created_by = v_caller
        OR EXISTS (
          SELECT 1 FROM club_memberships cm
          WHERE cm.club_id = t.club_id
            AND cm.user_id = v_caller
            AND cm.role IN ('owner', 'admin')
            AND cm.status = 'active'
        )
      )
  ) INTO v_is_team_admin;

  IF NOT v_is_team_admin THEN
    RAISE EXCEPTION 'Not authorized to add players to this team' USING ERRCODE = '42501';
  END IF;

  v_slug := lower(regexp_replace(p_full_name, '[^a-zA-Z0-9]', '', 'g'));
  IF v_slug = '' THEN
    v_slug := 'player';
  END IF;

  v_username := public.generate_unique_username(p_full_name, NULL, NULL);

  INSERT INTO users (email, full_name, username)
  VALUES (
    'player.' || v_slug || '.' || substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '@players.local',
    p_full_name,
    v_username
  )
  RETURNING id INTO v_user_id;

  INSERT INTO team_players (team_id, user_id, added_by, jersey_number, is_playing_xi)
  VALUES (p_team_id, v_user_id, v_caller, p_jersey_number, true);

  RETURN json_build_object(
    'user_id', v_user_id,
    'full_name', p_full_name,
    'jersey_number', p_jersey_number,
    'username', v_username
  );
END;
$$;
