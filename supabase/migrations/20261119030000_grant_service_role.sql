-- Garante explicitamente os privilégios da role service_role nas tabelas,
-- caso os grants padrão não tenham sido aplicados. (service_role é a role
-- usada pelas funções /api; ela ignora o RLS, mas ainda precisa do GRANT.)
grant all on public.hits to service_role;
grant all on public.form_submissions to service_role;
