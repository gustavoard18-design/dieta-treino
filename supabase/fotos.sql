-- Análise de fotos por IA (15/10/2026)
-- Limite diário por conta: conta as análises por dia (horário de Brasília) e por modo (rapido / melhor).
create table if not exists public.foto_uso (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  modo text not null,
  n int not null default 0,
  primary key (user_id, dia, modo)
);
alter table public.foto_uso enable row level security; -- sem políticas: só o servidor acessa

-- Soma 1 e devolve o total do dia; devolve -1 se já chegou ao limite.
create or replace function public.usa_foto(p_uid uuid, p_modo text, p_limite int) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into foto_uso (user_id, dia, modo, n)
  values (p_uid, (now() at time zone 'America/Sao_Paulo')::date, p_modo, 1)
  on conflict (user_id, dia, modo) do update set n = foto_uso.n + 1 where foto_uso.n < p_limite
  returning n into v;
  return coalesce(v, -1);
end $$;

-- Devolve a análise quando a IA falha (não conta no limite).
create or replace function public.devolve_foto(p_uid uuid, p_modo text) returns void
language sql security definer set search_path = public as $$
  update foto_uso set n = greatest(n - 1, 0)
  where user_id = p_uid and dia = (now() at time zone 'America/Sao_Paulo')::date and modo = p_modo;
$$;

-- Só o servidor (service role) pode chamar estas funções; o app não consegue zerar o próprio limite.
revoke execute on function public.usa_foto(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.devolve_foto(uuid, text) from public, anon, authenticated;

-- Teste Haiku x Sonnet: cada foto do modo teste guarda o resultado dos dois modelos e uma miniatura.
create table if not exists public.foto_teste (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado timestamptz not null default now(),
  haiku jsonb,
  sonnet jsonb,
  miniatura text
);
alter table public.foto_teste enable row level security;
create policy "dono le teste" on public.foto_teste for select using (auth.uid() = user_id);

-- Contas em teste Haiku x Sonnet (ligado no servidor, vale em qualquer aparelho/navegador da conta)
create table if not exists public.foto_teste_contas (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.foto_teste_contas enable row level security;
create policy "dono ve se testa" on public.foto_teste_contas for select using (auth.uid() = user_id);
insert into public.foto_teste_contas (user_id) select id from auth.users where email = 'thaywanedsa@gmail.com' on conflict do nothing;
