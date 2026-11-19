import { supabase } from '../lib/supabase.js';

// Registra UM acesso à página de demonstração.
// NÃO coleta dados pessoais de quem acessa — apenas insere uma linha com
// horário, referrer e user-agent (metadados de requisição, como um log de
// servidor), para alimentar o painel de métricas.
export default async function handler(req, res) {
  try {
    const ref = String(req.headers['referer'] || req.headers['referrer'] || '').slice(0, 300);
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);

    await supabase.from('hits').insert({
      referrer: ref || null,
      user_agent: ua || null,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    // Métrica nunca deve quebrar a experiência da página.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
