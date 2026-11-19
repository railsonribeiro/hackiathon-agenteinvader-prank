import { redis } from '../lib/metrics.js';

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
    const [total, byday, events] = await Promise.all([
      redis.get('hits:total'),
      redis.hgetall('hits:byday'),
      redis.lrange('hits:events', 0, 49),
    ]);

    const parsedEvents = (events || [])
      .map((e) => {
        try {
          return typeof e === 'string' ? JSON.parse(e) : e;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      total: Number(total || 0),
      byday: byday || {},
      events: parsedEvents,
    });
  } catch (err) {
    res.status(500).json({ error: 'metrics_unavailable' });
  }
}
