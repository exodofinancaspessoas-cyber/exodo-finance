
-- 1. Ensure profiles table exists and has a backfill
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.profiles (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure subscriptions table exists and has a backfill
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'TRIAL' CHECK (plan IN ('TRIAL','PRO','BLOCKED')),
  trial_starts TIMESTAMPTZ DEFAULT NOW(),
  trial_ends TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  blocked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

INSERT INTO public.subscriptions (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 3. Update the admin view to include more payment-related info
-- We'll assume "recebimentos" can be inferred from confirmed income vs total transactions
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
  COALESCE(t.total_transactions, 0) AS total_transactions,
  COALESCE(acc.total_balance, 0) AS total_balance,
  COALESCE(t.confirmed_income, 0) AS confirmed_income,
  COALESCE(t.pending_income, 0) AS pending_income,
  t.last_activity,
  CASE
    WHEN s.plan = 'BLOCKED' THEN 'BLOQUEADO'
    WHEN s.trial_ends < NOW() THEN 'EXPIRADO'
    WHEN s.trial_ends < NOW() + INTERVAL '7 days' THEN 'EXPIRANDO'
    WHEN s.plan = 'PRO' THEN 'PRO'
    ELSE 'ATIVO'
  END AS status,
  GREATEST(0, EXTRACT(DAY FROM (s.trial_ends - NOW()))::INT) AS dias_restantes
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status != 'EXCLUIDA') AS total_transactions,
    SUM(amount) FILTER (WHERE type = 'RECEITA' AND status IN ('CONFIRMADA', 'RECEBIDA')) AS confirmed_income,
    SUM(amount) FILTER (WHERE type = 'RECEITA' AND status IN ('PREVISTA', 'INCOMPLETA')) AS pending_income,
    MAX(created_at) AS last_activity
  FROM public.transactions
  GROUP BY user_id
) t ON t.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(balance) AS total_balance
  FROM public.accounts
  GROUP BY user_id
) acc ON acc.user_id = p.id;
