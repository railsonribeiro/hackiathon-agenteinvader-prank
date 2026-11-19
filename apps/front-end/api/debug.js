import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Observabilidade / diagnóstico. PROTEGIDO: exige login do Supabase (mesma
// autenticação do /api/metrics). Não expõe segredos — só o TIPO/role da chave.
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
  res.setHeader('Cache-Control', 'no-store');

  // Autenticação (igual ao /api/metrics).
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  try {
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data || !data.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
  } catch (e) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const out = {
    env: { SUPABASE_URL: !!supabaseUrl },
    serviceKey: keyInfo(serviceKey),
    anonKey: keyInfo(anonKey),
  };

  if (!supabaseUrl || !serviceKey) {
    out.fatal = 'Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.';
    res.status(200).json(out);
    return;
  }

  try {
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Teste de escrita só sob demanda (?write=1), para não poluir as métricas.
    const doWrite = req.query && (req.query.write === '1' || req.query.write === 'true');
    if (doWrite) {
      const ins = await sb.from('hits').insert({ created_at: new Date().toISOString() });
      out.insertHit = { ok: !ins.error, error: ins.error ? ins.error.message : null };
    } else {
      out.insertHit = null; // não testado
    }

    const h = await sb.from('hits').select('*', { count: 'exact', head: true });
    out.hits = { count: h.count, error: h.error ? h.error.message : null };
    const s = await sb.from('form_submissions').select('*', { count: 'exact', head: true });
    out.form_submissions = { count: s.count, error: s.error ? s.error.message : null };
  } catch (e) {
    out.exception = String((e && e.message) || e);
  }

  res.status(200).json(out);
}
