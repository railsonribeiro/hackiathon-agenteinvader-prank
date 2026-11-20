-- Quem preencheu o formulário com os dados do PDF do hackathon? Para medir isso
-- sem guardar nada identificável, registramos apenas a QUANTIDADE DE CARACTERES
-- digitada em cada campo (nunca o conteúdo). Comparada ao tamanho esperado dos
-- valores do PDF, ela indica quem preencheu "como esperado".
--   Crachá  00994     -> 5
--   Placa   RQK-7A26  -> 7 a 8 (com ou sem hífen)
--   Sala    1407      -> 4
--   Pedido  471       -> 3
-- Envios anteriores a esta coleta ficam com as colunas nulas.

alter table public.form_submissions
  add column if not exists cracha_len smallint,
  add column if not exists placa_len  smallint,
  add column if not exists sala_len   smallint,
  add column if not exists pedido_len smallint;

-- Agregado para o painel: total de envios, quantos acertaram o tamanho de cada
-- campo e quantos acertaram os quatro. Só contagens — jamais o conteúdo.
create or replace view public.submission_fill as
  select
    count(*)::int                                                      as total,
    count(*) filter (where cracha_len = 5)::int                        as cracha_ok,
    count(*) filter (where placa_len between 7 and 8)::int             as placa_ok,
    count(*) filter (where sala_len = 4)::int                          as sala_ok,
    count(*) filter (where pedido_len = 3)::int                        as pedido_ok,
    count(*) filter (
      where cracha_len = 5 and placa_len between 7 and 8
        and sala_len = 4 and pedido_len = 3
    )::int                                                             as all_ok,
    count(*) filter (
      where cracha_len is not null or placa_len is not null
         or sala_len is not null or pedido_len is not null
    )::int                                                             as with_lengths
  from public.form_submissions;

alter view public.submission_fill set (security_invoker = true);
revoke all on public.submission_fill from anon, authenticated;
grant select on public.submission_fill to service_role;
