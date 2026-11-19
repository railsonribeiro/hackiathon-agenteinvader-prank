-- Localização agregada dos acessos: só país/região/cidade (grosseiro),
-- derivado dos cabeçalhos de geo do Vercel. NÃO guardamos IP nem nada que
-- identifique a pessoa — é analytics agregado, fora do escopo de dado pessoal.

alter table public.hits add column if not exists country text;
alter table public.hits add column if not exists region  text;
alter table public.hits add column if not exists city    text;

-- View com a contagem de acessos por localização.
create or replace view public.hits_by_location as
  select
    coalesce(nullif(country, ''), '—') as country,
    coalesce(region, '')               as region,
    coalesce(city, '')                 as city,
    count(*)::int                      as count
  from public.hits
  group by country, region, city
  order by count desc;

alter view public.hits_by_location set (security_invoker = true);
revoke all on public.hits_by_location from anon, authenticated;
grant select on public.hits_by_location to service_role;
