-- ==============================================================================
-- Migration: Sync User Profiles & Metadata on Signup Trigger
-- Description:
--   1. Ensures phone, discord_id, is_banned, created_ip columns exist in public.profiles.
--   2. Creates or updates the public.handle_new_user() trigger function on auth.users.
--   3. Automatically copies raw_user_meta_data (phone, discord_id, created_ip) into profiles.
-- ==============================================================================

-- 1. Ensure profile table columns exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS discord_id TEXT,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_ip TEXT;

-- 2. Create trigger function to sync user metadata automatically on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    username,
    phone,
    discord_id,
    created_ip,
    is_banned
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'discord_id',
    NEW.raw_user_meta_data->>'created_ip',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    discord_id = COALESCE(EXCLUDED.discord_id, public.profiles.discord_id),
    created_ip = COALESCE(EXCLUDED.created_ip, public.profiles.created_ip);

  RETURN NEW;
END;
$$;

-- 3. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
