-- Caminho que levou à revelação, para separar no painel quem "caiu" (preencheu
-- o formulário) de quem não caiu (deixou o cronômetro esgotar e viu a revelação
-- assim mesmo). Agregado e sem IP, como o resto.
--   'form'    -> clicou em "Confirmar" e caiu na isca
--   'timeout' -> o cronômetro de urgência esgotou e a revelação apareceu
-- Avaliações anteriores a esta coleta ficam com o caminho nulo.

alter table public.feedback add column if not exists path text;
