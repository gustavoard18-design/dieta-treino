-- Rode isto no Supabase: SQL Editor > New query > Run
-- Uma linha por usuário com todos os dados do app em JSON.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Cada usuário só lê e grava a própria linha.
create policy "dono le" on public.app_state for select using (auth.uid() = user_id);
create policy "dono insere" on public.app_state for insert with check (auth.uid() = user_id);
create policy "dono atualiza" on public.app_state for update using (auth.uid() = user_id);
