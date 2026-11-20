-- Concede privilégios à role service_role nas tabelas novas, como já foi feito
-- para hits/form_submissions em 20261119030000. As funções /api usam
-- service_role: ela ignora o RLS, mas ainda PRECISA do GRANT para ler/gravar.
--
-- Sem isto, o INSERT em funnel_events (/api/event) e em feedback (/api/feedback)
-- dava "permission denied" — o clique/ a avaliação não eram persistidos — e as
-- views com security_invoker (funnel_counts, feedback_stats) não liam a tabela
-- base, aparecendo zeradas no painel.
grant all on public.funnel_events to service_role;
grant all on public.feedback to service_role;
