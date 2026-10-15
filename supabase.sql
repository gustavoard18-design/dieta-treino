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

-- Cópias de segurança automáticas (rodado em 15/10/2026)
-- Antes de cada mudança na conta, guarda a versão anterior: no máximo 1 por hora,
-- e SEMPRE que refeições diminuírem ou o perfil sumir. Mantém 60 dias.
create table if not exists public.app_state_hist (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.app_state_hist enable row level security;
create policy "dono le hist" on public.app_state_hist for select using (auth.uid() = user_id);
create or replace function public.guarda_hist() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.data is distinct from new.data and (
       (select coalesce(max(saved_at), 'epoch'::timestamptz) from app_state_hist where user_id = old.user_id) < now() - interval '1 hour'
    or coalesce(jsonb_array_length(new.data->'refeicoes'), 0) < coalesce(jsonb_array_length(old.data->'refeicoes'), 0)
    or new.data->'perfil' is null) then
    insert into app_state_hist(user_id, data) values (old.user_id, old.data);
  end if;
  delete from app_state_hist where user_id = old.user_id and saved_at < now() - interval '60 days';
  return new;
end $$;
drop trigger if exists app_state_hist_tg on public.app_state;
create trigger app_state_hist_tg before update on public.app_state for each row execute function public.guarda_hist();
