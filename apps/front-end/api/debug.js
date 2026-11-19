import { createClient } from '@supabase/supabase-js';

// Diagnóstico temporário. Não expõe segredos: mostra apenas o TIPO e a ROLE
// da chave (claim pública do JWT), se as variáveis existem e o erro do banco.
function keyInfo(key) {
  if (!key) return { present: false };
  if (key.startsWith('sb_secret')) return { present: true, type: 'sb_secret (secreta)' };
  if (key.startsWith('sb_publishable')) return { present: true, type: 'sb_publishable (pública)' };
  if (key.startsWith('eyJ')) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      return { present: true, type: 'jwt (legada)', role: claims.role || '(sem role)' };
    } catch (e) {
      return { present: true, type: 'jwt (não decodificou)' };
    }
  }
  return { present: true, type: 'formato desconhecido' };
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  const out = {
    env: { SUPABASE_URL: !!url },
    serviceKey: keyInfo(serviceKey), // esperado: role "service_role" ou tipo sb_secret
    anonKey: keyInfo(anonKey), // esperado: role "anon" ou tipo sb_publishable
  };

  res.setHeader('Cache-Control', 'no-store');

  if (!url || !serviceKey) {
    out.fatal = 'Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.';
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
