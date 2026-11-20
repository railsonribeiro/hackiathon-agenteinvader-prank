-- Localidade de quem avaliou: país/região/cidade, derivados dos cabeçalhos de
-- geo do Vercel (o mesmo que já é feito em hits). Grosseiro e sem IP — não
-- identifica a pessoa. Avaliações antigas ficam com as colunas nulas.

alter table public.feedback add column if not exists country text;
alter table public.feedback add column if not exists region  text;
alter table public.feedback add column if not exists city    text;
