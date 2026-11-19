-- Segurança: agora que a chave anon (pública) vai para o navegador (login no
-- painel), a tabela precisa ficar inacessível pela API REST do Supabase para as
-- roles públicas. Com RLS ligado e SEM políticas, anon/authenticated não leem
-- nem escrevem via PostgREST. As funções /api usam o service_role, que ignora
-- o RLS e continua com acesso total.

alter table public.hits enable row level security;

-- A view passa a respeitar o RLS de quem consulta (não expõe dados ao anon).
alter view public.hits_by_day set (security_invoker = true);

-- Defesa extra: remove os grants padrão das roles públicas.
revoke all on public.hits from anon, authenticated;
revoke all on public.hits_by_day from anon, authenticated;
