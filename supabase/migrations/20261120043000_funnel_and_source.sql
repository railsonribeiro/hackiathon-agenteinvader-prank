-- Funil de conversão + origem dos acessos. Tudo server-side e AGREGADO:
-- sem IP, sem cookie e sem referrer. São apenas contagens por etapa/canal.

-- ----------------------------------------------------------------------------
-- Origem (canal) do acesso
-- ----------------------------------------------------------------------------
-- Tag first-party passada na própria URL do link (ex.: ?s=whatsapp). NÃO é
-- referrer nem dado pessoal — só diz por qual canal o link chegou. Vazio/ausente
-- é tratado como "direto".
alter table public.hits add column if not exists source text;

create or replace view public.hits_by_source as
  select
    coalesce(nullif(source, ''), 'direto') as source,
    count(*)::int                          as count
  from public.hits
  group by 1
  order by count desc;

alter view public.hits_by_source set (security_invoker = true);
revoke all on public.hits_by_source from anon, authenticated;
grant select on public.hits_by_source to service_role;

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
