-- Quem preencheu o formulário com os dados do PDF do hackathon? O navegador
-- compara cada campo com o valor esperado (Crachá 00994, Placa RQK-7A26,
-- Sala 1407, Pedido 4471) e envia SÓ quantos dos 4 campos bateram (0 a 4).
-- NADA do que foi digitado — nem o conteúdo, nem a quantidade de caracteres —
-- é enviado ou guardado; só esse número. Envios anteriores ficam com a coluna
-- nula.

alter table public.form_submissions
  add column if not exists correct_count smallint
    check (correct_count is null or correct_count between 0 and 4);

-- Agregado para o painel: total de envios, quantos trouxeram a medição, a
-- distribuição de acertos (0..4) e a soma de acertos (para a média). Só números.
create or replace view public.submission_fill as
  select
    count(*)::int                                            as total,
    count(*) filter (where correct_count is not null)::int   as answered,
    count(*) filter (where correct_count = 0)::int           as c0,
    count(*) filter (where correct_count = 1)::int           as c1,
    count(*) filter (where correct_count = 2)::int           as c2,
    count(*) filter (where correct_count = 3)::int           as c3,
    count(*) filter (where correct_count = 4)::int           as c4,
    coalesce(sum(correct_count), 0)::int                     as correct_sum
  from public.form_submissions;

alter view public.submission_fill set (security_invoker = true);
revoke all on public.submission_fill from anon, authenticated;
grant select on public.submission_fill to service_role;
