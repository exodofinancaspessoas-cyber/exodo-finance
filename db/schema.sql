
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  avatar_url text,
  currency text default 'BRL',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Accounts
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  type text not null, -- 'CORRENTE', 'POUPANCA', 'INVESTIMENTO', 'DINHEIRO', 'OUTRO'
  balance numeric(15,2) default 0,
  initial_balance numeric(15,2) default 0,
  color text,
  bank text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Credit Cards
create table public.cards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  limit_amount numeric(15,2) not null,
  closing_day integer not null,
  due_day integer not null,
  brand text, -- 'VISA', 'MASTERCARD', etc
  bank text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Categories
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  type text not null, -- 'RECEITA', 'DESPESA'
  icon text,
  color text,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transactions
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  description text not null,
  amount numeric(15,2) not null,
  type text not null, -- 'RECEITA', 'DESPESA', 'TRANSFERENCIA'
  category_id uuid references public.categories(id),
  account_id uuid references public.accounts(id),
  card_id uuid references public.cards(id),
  date date not null,
  status text not null default 'CONFIRMADA', -- 'PREVISTA', 'CONFIRMADA', 'PAGA', 'RECEBIDA'
  payment_method text, -- 'CREDITO', 'DEBITO', 'PIX', 'DINHEIRO'
  installments_current integer,
  installments_total integer,
  observation text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Recurring Expenses
create table public.recurring_expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  description text not null,
  amount numeric(15,2) not null,
  category_id uuid references public.categories(id),
  account_id uuid references public.accounts(id),
  card_id uuid references public.cards(id),
  frequency text default 'MENSAL',
  day_of_month integer not null,
  type text not null, -- 'FIXA', 'VARIAVEL'
  active boolean default true,
  auto_create boolean default true,
  last_generated date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Goals
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) default 0,
  deadline date,
  status text default 'EM_ANDAMENTO',
  color text,
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Budgets
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  category_id uuid references public.categories(id) not null,
  amount numeric(15,2) not null,
  month text not null, -- 'YYYY-MM'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Row Level Security)
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.goals enable row level security;
alter table public.budgets enable row level security;

-- Create policies to ensure users only see their own data
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own accounts" on public.accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on public.accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on public.accounts for delete using (auth.uid() = user_id);

-- (Repeat for all other tables...)
create policy "Users can view own cards" on public.cards for select using (auth.uid() = user_id);
create policy "Users can insert own cards" on public.cards for insert with check (auth.uid() = user_id);
create policy "Users can update own cards" on public.cards for update using (auth.uid() = user_id);
create policy "Users can delete own cards" on public.cards for delete using (auth.uid() = user_id);

create policy "Users can view own categories" on public.categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on public.categories for delete using (auth.uid() = user_id);

create policy "Users can view own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions for delete using (auth.uid() = user_id);

create policy "Users can view own recurring_expenses" on public.recurring_expenses for select using (auth.uid() = user_id);
create policy "Users can insert own recurring_expenses" on public.recurring_expenses for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring_expenses" on public.recurring_expenses for update using (auth.uid() = user_id);
create policy "Users can delete own recurring_expenses" on public.recurring_expenses for delete using (auth.uid() = user_id);

create policy "Users can view own goals" on public.goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals" on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals" on public.goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals" on public.goals for delete using (auth.uid() = user_id);

create policy "Users can view own budgets" on public.budgets for select using (auth.uid() = user_id);
create policy "Users can insert own budgets" on public.budgets for insert with check (auth.uid() = user_id);
create policy "Users can update own budgets" on public.budgets for update using (auth.uid() = user_id);
create policy "Users can delete own budgets" on public.budgets for delete using (auth.uid() = user_id);

-- Function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile when auth.users is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
