-- ============================================================
-- ÊXODO FINANCE — Admin Panel Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. profiles table (sync from auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users into profiles
INSERT INTO public.profiles (id, email, name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- 2. subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'TRIAL' CHECK (plan IN ('TRIAL','PRO','BLOCKED')),
  trial_starts TIMESTAMPTZ DEFAULT NOW(),
  trial_ends  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  blocked_at  TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Auto-create subscription on profile insert
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- Backfill subscriptions for existing profiles
INSERT INTO public.subscriptions (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- 3. admin_users_overview VIEW (used by Edge Function)
CREATE OR REPLACE VIEW public.admin_users_overview AS
SELECT
  p.id,
  p.name,
  p.email,
  p.created_at,
  s.plan,
  s.trial_starts,
  s.trial_ends,
  s.blocked_at,
  s.notes,
  COALESCE(t.total_transactions, 0)     AS total_transactions,
  COALESCE(acc.total_balance, 0)        AS total_balance,
  t.last_activity,
  CASE
    WHEN s.plan = 'BLOCKED'             THEN 'BLOQUEADO'
    WHEN s.trial_ends < NOW()           THEN 'EXPIRADO'
    WHEN s.trial_ends < NOW() + INTERVAL '7 days' THEN 'EXPIRANDO'
    WHEN s.plan = 'PRO'                 THEN 'PRO'
    ELSE 'ATIVO'
  END                                   AS status,
  GREATEST(0, EXTRACT(DAY FROM (s.trial_ends - NOW()))::INT) AS dias_restantes
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status != 'EXCLUIDA') AS total_transactions,
    MAX(created_at) AS last_activity
  FROM public.transactions
  GROUP BY user_id
) t ON t.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(balance) AS total_balance
  FROM public.accounts
  GROUP BY user_id
) acc ON acc.user_id = p.id
ORDER BY p.created_at DESC;
