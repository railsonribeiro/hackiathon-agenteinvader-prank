import { supabase } from '../lib/supabase.js';

// Devolve as métricas agregadas para o painel.
// O acesso é protegido pelo middleware (login HTTP Basic) — veja middleware.js.
export default async function handler(req, res) {
  try {
    const [totalRes, bydayRes, eventsRes] = await Promise.all([
      supabase.from('hits').select('*', { count: 'exact', head: true }),
      supabase.from('hits_by_day').select('*'),
      supabase
        .from('hits')
        .select('created_at, referrer, user_agent')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const byday = {};
    (bydayRes.data || []).forEach((r) => {
      byday[r.day] = r.count;
    });

    const events = (eventsRes.data || []).map((r) => ({
      t: r.created_at,
      ref: r.referrer || '',
      ua: r.user_agent || '',
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      total: Number(totalRes.count || 0),
      byday,
      events,
    });
  } catch (err) {
    res.status(500).json({ error: 'metrics_unavailable' });
  }
}
