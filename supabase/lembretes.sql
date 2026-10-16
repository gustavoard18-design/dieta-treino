-- Lembretes por notificação push (ADR 0004) — 16/10/2026
-- Aparelhos inscritos para receber push (um por navegador/app instalado)
create table if not exists public.push_inscricoes (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
create policy "dono gerencia inscricoes" on public.push_inscricoes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lembretes escolhidos pela pessoa: horário (Brasília) e dias da semana (0 = domingo ... 6 = sábado)
create table if not exists public.lembretes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  hora time not null,
  dias smallint[] not null default '{0,1,2,3,4,5,6}',
  ativo boolean not null default true,
  ultimo_envio date
);
alter table public.lembretes enable row level security;
create policy "dono gerencia lembretes" on public.lembretes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chaves VAPID do push, criadas pela própria função na primeira vez (só o servidor lê)
create table if not exists public.push_config (id int primary key default 1, publica text not null, privada text not null);
alter table public.push_config enable row level security;

-- Retenção das miniaturas do teste de fotos: 30 dias (LGPD)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('limpa-foto-teste', '0 3 * * *', $$ delete from public.foto_teste where criado < now() - interval '30 days' $$);

-- Dispara os lembretes push a cada 5 minutos (a função só envia os que já chegaram no horário e ainda não foram enviados hoje).
-- O cabeçalho usa a chave pública (anon), a mesma que já está no app.
select cron.schedule('lembretes-push', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://lnfenrfbiymnfwseidbj.supabase.co/functions/v1/lembretes-push',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{"acao":"enviar"}'::jsonb
  )
$$);
