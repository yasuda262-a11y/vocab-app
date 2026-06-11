-- vocab-app Supabase setup
-- Run this in the Supabase SQL Editor (same project as ube-app and household-finance)

create table if not exists public.vocab_store (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  flags jsonb not null default '[]',
  custom_words jsonb not null default '[]',
  overrides jsonb not null default '{}',
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.vocab_store enable row level security;

create policy "Users manage own vocab data" on public.vocab_store
  for all using (auth.uid() = user_id);
