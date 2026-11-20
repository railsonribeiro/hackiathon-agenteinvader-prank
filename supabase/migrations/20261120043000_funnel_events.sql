-- Funil de conversão. Tudo server-side e AGREGADO: sem IP, sem cookie e sem
-- referrer. São apenas contagens por etapa.

-- ----------------------------------------------------------------------------
-- Estágios do funil posteriores à abertura
-- ----------------------------------------------------------------------------
-- O topo do funil (aberturas) e o "preencheram" já vêm das tabelas hits e
-- form_submissions. Aqui ficam só os dois estágios novos:
--   'reveal'   -> chegou na tela de revelação ("PARE / foi uma simulação")
--   'official' -> clicou no link oficial do hackathon na revelação
-- Contagem bruta de passagens por etapa (sem IP, sem dedup).
create table if not exists public.funnel_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  stage      text not null
);

create index if not exists funnel_events_stage_idx on public.funnel_events (stage);

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;

create or replace view public.funnel_counts as
  select stage, count(*)::int as count
  from public.funnel_events
  group by stage;

alter view public.funnel_counts set (security_invoker = true);
revoke all on public.funnel_counts from anon, authenticated;
grant select on public.funnel_counts to service_role;
