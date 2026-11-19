-- Simplifica as métricas: o painel passa a mostrar só dois números
-- (acessos e quantos clicaram em "Confirmar"). Remove dados de referrer/
-- user-agent da tabela de acessos.

-- A view agregada por dia não é mais usada.
drop view if exists public.hits_by_day;

-- Remove colunas de rastreio; sobra apenas id + created_at (contagem de acessos).
alter table public.hits drop column if exists referrer;
alter table public.hits drop column if exists user_agent;
alter table public.hits drop column if exists day;

-- Contador de preenchimentos do formulário (só o clique; nenhum dado do form).
create table if not exists public.form_submissions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

-- Mesma proteção da tabela hits: RLS ligado e sem acesso para as roles públicas.
alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from anon, authenticated;
