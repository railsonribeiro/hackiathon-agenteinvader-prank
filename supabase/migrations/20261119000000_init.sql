-- Migration inicial: tabela de acessos + view agregada por dia.
-- Aplicada automaticamente pelo CI (GitHub Actions -> supabase db push).

-- Tabela de acessos. Cada visita vira uma linha.
create table if not exists public.hits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  day         date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  referrer    text,
  user_agent  text
);

create index if not exists hits_created_at_idx on public.hits (created_at desc);

-- View com os acessos agregados por dia (fuso de São Paulo).
create or replace view public.hits_by_day as
  select day, count(*)::int as count
  from public.hits
  group by day
  order by day;

-- Observação: as funções /api usam a chave secreta (service_role), que ignora
-- o RLS. Como nada é lido pelo navegador com chave pública, não é necessário
-- configurar políticas de RLS para esta demonstração.
