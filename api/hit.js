import { redis, spDay } from '../lib/metrics.js';

// Registra UM acesso à página de demonstração.
// NÃO coleta dados pessoais de quem acessa — apenas conta a visita e guarda
// metadados básicos de requisição (horário, referrer, user-agent), como um
// log de acesso comum, para alimentar o painel de métricas.
export default async function handler(req, res) {
  try {
    const now = new Date();
    const day = spDay(now);

    const ref = String(req.headers['referer'] || req.headers['referrer'] || '').slice(0, 300);
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);

    const pipe = redis.pipeline();
    pipe.incr('hits:total');
    pipe.hincrby('hits:byday', day, 1);
    pipe.lpush('hits:events', JSON.stringify({ t: now.toISOString(), day, ref, ua }));
    pipe.ltrim('hits:events', 0, 199); // mantém só os 200 acessos mais recentes
    await pipe.exec();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    // Métrica nunca deve quebrar a experiência da página.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
