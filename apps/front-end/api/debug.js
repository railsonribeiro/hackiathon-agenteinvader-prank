import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Observabilidade: saúde do banco, teste de escrita (opt-in) e contadores.
// PROTEGIDO: exige login do Supabase (mesma autenticação do /api/metrics).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

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

  const out = {};
  try {
    // Teste de escrita só sob demanda (?write=1), para não poluir as métricas.
    const doWrite = req.query && (req.query.write === '1' || req.query.write === 'true');
    if (doWrite) {
      const ins = await supabase.from('hits').insert({ created_at: new Date().toISOString() });
      out.insertHit = { ok: !ins.error, error: ins.error ? ins.error.message : null };
    } else {
      out.insertHit = null;
    }

    const h = await supabase.from('hits').select('*', { count: 'exact', head: true });
    out.hits = { count: h.count, error: h.error ? h.error.message : null };
    const s = await supabase.from('form_submissions').select('*', { count: 'exact', head: true });
    out.form_submissions = { count: s.count, error: s.error ? s.error.message : null };
  } catch (e) {
    out.exception = String((e && e.message) || e);
  }

  res.status(200).json(out);
}
