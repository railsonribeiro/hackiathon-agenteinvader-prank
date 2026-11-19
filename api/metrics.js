import { supabase } from '../lib/supabase.js';

// Devolve as métricas agregadas para o painel.
// Pode ser protegido com DASHBOARD_TOKEN (opcional).
export default async function handler(req, res) {
  const required = process.env.DASHBOARD_TOKEN;
  if (required) {
    const token = (req.query && req.query.token) || '';
    if (token !== required) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

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
