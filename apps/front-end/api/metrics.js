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
    const [accessRes, submitRes, locRes, funnelRes, fbStatsRes, fbRowsRes] = await Promise.all([
      supabase.from('hits').select('*', { count: 'exact', head: true }),
      supabase.from('form_submissions').select('*', { count: 'exact', head: true }),
      supabase.from('hits_by_location').select('*').limit(50),
      supabase.from('funnel_counts').select('*'),
      supabase.from('feedback_stats').select('*').single(),
      supabase.from('feedback').select('rating, comment, created_at').order('created_at', { ascending: false }).limit(200),
    ]);

    const locations = (locRes.data || []).map((r) => ({
      country: r.country || '—',
      region: r.region || '',
      city: r.city || '',
      count: Number(r.count || 0),
    }));

    const accesses = Number(accessRes.count || 0);
    const submissions = Number(submitRes.count || 0);

    // "Chegaram na revelação" = clique em "Confirmar" (form_submissions), que
    // leva direto à revelação e já tem histórico. Só 'official' é evento novo.
    const stageCount = {};
    (funnelRes.data || []).forEach((r) => { stageCount[r.stage] = Number(r.count || 0); });

    // Feedback: total, média, distribuição das notas e comentários recentes.
    const fbRows = fbRowsRes.data || [];
    const fbCount = Number((fbStatsRes.data && fbStatsRes.data.count) || fbRows.length || 0);
    const fbAvg = Number((fbStatsRes.data && fbStatsRes.data.avg_rating) || 0);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    fbRows.forEach((r) => { const n = Number(r.rating); if (distribution[n] != null) distribution[n] += 1; });
    const comments = fbRows
      .filter((r) => r.comment)
      .slice(0, 50)
      .map((r) => ({ rating: Number(r.rating), comment: r.comment, created_at: r.created_at }));

    const funnel = [
      { key: 'open', label: 'Abriram a página', count: accesses },
      { key: 'reveal', label: 'Chegaram na revelação', count: submissions },
      { key: 'official', label: 'Clicaram no link oficial', count: stageCount.official || 0 },
      { key: 'feedback', label: 'Avaliaram a simulação', count: fbCount },
    ];

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      accesses,
      submissions,
      locations,
      funnel,
      feedback: { count: fbCount, avg: fbAvg, distribution, comments },
    });
  } catch (err) {
    res.status(500).json({ error: 'metrics_unavailable' });
  }
}
