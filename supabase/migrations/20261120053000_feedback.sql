-- Feedback da revelação: o usuário avalia a ideia da simulação de engenharia
-- social. Persistido aqui. Agregado e anônimo — sem IP e sem nada que
-- identifique o usuário; guarda só a nota e um comentário opcional.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rating     smallint not null check (rating between 1 and 5),
  comment    text
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- Mesma proteção das demais tabelas: RLS ligado e sem acesso para as roles
-- públicas. As funções /api usam a chave service_role, que ignora o RLS.
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- Agregados para o painel: total de avaliações e média das notas.
create or replace view public.feedback_stats as
  select
    count(*)::int                              as count,
    coalesce(round(avg(rating)::numeric, 2), 0) as avg_rating
  from public.feedback;

alter view public.feedback_stats set (security_invoker = true);
revoke all on public.feedback_stats from anon, authenticated;
grant select on public.feedback_stats to service_role;
