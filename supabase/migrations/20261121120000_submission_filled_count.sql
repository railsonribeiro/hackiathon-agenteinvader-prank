-- Quem clicou em "Confirmar" sem preencher nada? Continua contando como "caiu"
-- (interagiu com a página), mas o funil passa a discriminar esse caso.
--
-- O navegador envia só QUANTOS dos 4 campos estavam preenchidos (0 a 4) —
-- nada do conteúdo e nem a quantidade de caracteres. Junto com correct_count,
-- dá para separar:
--   filled_count = 0                              -> clicou sem preencher
--   filled_count > 0                              -> preencheu os campos
--   filled_count nulo e correct_count > 0         -> preencheu (envio antigo,
--                                                    mas acertar um campo
--                                                    implica tê-lo preenchido)
--   filled_count nulo e correct_count nulo ou 0   -> sem medição (envio antigo)

alter table public.form_submissions
  add column if not exists filled_count smallint
    check (filled_count is null or filled_count between 0 and 4);

-- Um campo correto é necessariamente um campo preenchido.
alter table public.form_submissions
  drop constraint if exists form_submissions_correct_le_filled;
alter table public.form_submissions
  add constraint form_submissions_correct_le_filled
    check (filled_count is null or correct_count is null or correct_count <= filled_count);

-- Mesma view do painel, com três colunas novas no fim (create or replace só
-- permite acrescentar colunas no final).
create or replace view public.submission_fill as
  select
    count(*)::int                                            as total,
    count(*) filter (where correct_count is not null)::int   as answered,
    count(*) filter (where correct_count = 0)::int           as c0,
    count(*) filter (where correct_count = 1)::int           as c1,
    count(*) filter (where correct_count = 2)::int           as c2,
    count(*) filter (where correct_count = 3)::int           as c3,
    count(*) filter (where correct_count = 4)::int           as c4,
    coalesce(sum(correct_count), 0)::int                     as correct_sum,
    count(*) filter (
      where filled_count > 0
         or (filled_count is null and correct_count > 0)
    )::int                                                   as filled,
    count(*) filter (where filled_count = 0)::int            as empty,
    count(*) filter (
      where filled_count is null and coalesce(correct_count, 0) = 0
    )::int                                                   as fill_unknown
  from public.form_submissions;

alter view public.submission_fill set (security_invoker = true);
revoke all on public.submission_fill from anon, authenticated;
grant select on public.submission_fill to service_role;
