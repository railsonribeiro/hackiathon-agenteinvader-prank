-- Visões de localização agregadas por país e por estado (região), além da
-- existente por cidade. O painel usa as três no mesmo card (padrão: estado),
-- para a lista não inflar com muitas cidades. Tudo agregado, sem IP.

-- Por país.
create or replace view public.hits_by_country as
  select
    coalesce(nullif(country, ''), '—') as country,
    count(*)::int                      as count
  from public.hits
  group by 1
  order by count desc;

alter view public.hits_by_country set (security_invoker = true);
revoke all on public.hits_by_country from anon, authenticated;
grant select on public.hits_by_country to service_role;

-- Por estado (região), dentro do país.
create or replace view public.hits_by_region as
  select
    coalesce(nullif(country, ''), '—') as country,
    coalesce(region, '')               as region,
    count(*)::int                      as count
  from public.hits
  group by country, region
  order by count desc;

alter view public.hits_by_region set (security_invoker = true);
revoke all on public.hits_by_region from anon, authenticated;
grant select on public.hits_by_region to service_role;
