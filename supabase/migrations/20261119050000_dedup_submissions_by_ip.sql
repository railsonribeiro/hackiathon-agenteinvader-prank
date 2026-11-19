-- Conta no máximo UMA vez por IP o clique em "Confirmar", para que vários
-- cliques da mesma pessoa não inflem as métricas do painel.
--
-- Privacidade: o IP em si NÃO é guardado. A função /api/submit calcula um
-- hash (SHA-256 com salt) do IP e grava apenas esse hash, que serve só para
-- deduplicar. Não dá para voltar do hash ao IP, e nenhum dado identificável
-- é persistido.

-- Hash do IP (não-reversível). Fica nulo quando não foi possível determinar o
-- IP; nesse caso o clique ainda é contado (fallback), pois não há como deduplicar.
alter table public.form_submissions
  add column if not exists ip_hash text;

-- No máximo um registro por hash de IP. Cliques repetidos do mesmo IP batem
-- nesse índice e são ignorados (ON CONFLICT DO NOTHING) pela /api/submit.
-- Linhas antigas (ip_hash nulo) convivem, pois NULLs são distintos no índice.
create unique index if not exists form_submissions_ip_hash_key
  on public.form_submissions (ip_hash);
