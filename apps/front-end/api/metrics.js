import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Devolve as métricas agregadas para o painel.
// Exige um usuário válido do Supabase: o cliente envia o token (JWT) no header
// Authorization, e aqui ele é validado no servidor. Qualquer usuário cadastrado
// no projeto Supabase tem acesso.
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData || !userData.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    // Acesso liberado para qualquer usuário cadastrado no Supabase.
    // (Para restringir, dá para checar userData.user.email aqui.)
  } catch (e) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  try {
    const [accessRes, submitRes, locRes] = await Promise.all([
      supabase.from('hits').select('*', { count: 'exact', head: true }),
      supabase.from('form_submissions').select('*', { count: 'exact', head: true }),
      supabase.from('hits_by_location').select('*').limit(50),
    ]);

    const locations = (locRes.data || []).map((r) => ({
      country: r.country || '—',
      region: r.region || '',
      city: r.city || '',
      count: Number(r.count || 0),
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      accesses: Number(accessRes.count || 0),
      submissions: Number(submitRes.count || 0),
      locations,
    });
  } catch (err) {
    res.status(500).json({ error: 'metrics_unavailable' });
  }
}
