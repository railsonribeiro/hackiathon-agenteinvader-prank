import { createClient } from '@supabase/supabase-js';

// Diagnóstico temporário. Não expõe segredos: só indica se as variáveis
// existem e qual erro o banco retorna ao inserir/contar. Remover depois.
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  const out = {
    env: {
      SUPABASE_URL: !!url,
      SERVICE_ROLE_KEY: !!serviceKey,
      ANON_KEY: !!anonKey,
    },
  };

  res.setHeader('Cache-Control', 'no-store');

  if (!url || !serviceKey) {
    out.fatal = 'Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.';
    res.status(200).json(out);
    return;
  }

  try {
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

    const ins = await sb.from('hits').insert({ created_at: new Date().toISOString() });
    out.insertHit = { ok: !ins.error, error: ins.error ? ins.error.message : null };

    const h = await sb.from('hits').select('*', { count: 'exact', head: true });
    out.hits = { count: h.count, error: h.error ? h.error.message : null };

    const s = await sb.from('form_submissions').select('*', { count: 'exact', head: true });
    out.form_submissions = { count: s.count, error: s.error ? s.error.message : null };
  } catch (e) {
    out.exception = String((e && e.message) || e);
  }

  res.status(200).json(out);
}
