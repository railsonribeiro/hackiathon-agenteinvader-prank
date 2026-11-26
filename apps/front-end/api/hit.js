import { supabase } from '../lib/supabase.js';
import { rejectIfClosed } from '../lib/closing.js';
import { rejectBadRequest } from '../lib/request-guard.js';

// Conta UM acesso (abertura da página). Guarda apenas localização agregada
// (país/região/cidade), vinda dos cabeçalhos de geo do Vercel — SEM IP e sem
// nada que identifique o usuário.
export default async function handler(req, res) {
  // Só POST da própria origem (ver lib/request-guard.js).
  if (rejectBadRequest(req, res)) return;
  // Hackathon encerrado: não grava mais nada (ver lib/closing.js).
  if (rejectIfClosed(res)) return;
  try {
    const country = req.headers['x-vercel-ip-country'] || null;
    const region = req.headers['x-vercel-ip-country-region'] || null;
    let city = req.headers['x-vercel-ip-city'] || null;
    if (city) {
      try { city = decodeURIComponent(city); } catch (e) { /* mantém como veio */ }
    }

    await supabase.from('hits').insert({
      created_at: new Date().toISOString(),
      country,
      region,
      city,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
