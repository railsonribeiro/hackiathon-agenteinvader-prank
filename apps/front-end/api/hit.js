import { supabase } from '../lib/supabase.js';

// Normaliza a tag de origem (?s=): minúsculas, só [a-z0-9_-], até 24 chars.
// Não é referrer nem dado pessoal — é um rótulo de canal (whatsapp, email…).
function cleanSource(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return s || null;
}

// Conta UM acesso (abertura da página). Guarda apenas localização agregada
// (país/região/cidade), vinda dos cabeçalhos de geo do Vercel, e a origem
// agregada (canal do link) — SEM IP e sem nada que identifique o usuário.
export default async function handler(req, res) {
  try {
    const country = req.headers['x-vercel-ip-country'] || null;
    const region = req.headers['x-vercel-ip-country-region'] || null;
    let city = req.headers['x-vercel-ip-city'] || null;
    if (city) {
      try { city = decodeURIComponent(city); } catch (e) { /* mantém como veio */ }
    }

    const source = cleanSource(req.body && req.body.source);

    await supabase.from('hits').insert({
      created_at: new Date().toISOString(),
      country,
      region,
      city,
      source,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
