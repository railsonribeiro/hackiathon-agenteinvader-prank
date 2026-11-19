import { createClient } from '@supabase/supabase-js';

// Usado APENAS no servidor (funções /api). A chave secreta ignora o RLS,
// então nunca deve ir para o navegador nem para o controle de versão.
const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || // chave legada (service_role)
  process.env.SUPABASE_SECRET_KEY; // chave nova (sb_secret_...)

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
