import { supabase } from '../lib/supabase.js';
import { rejectIfClosed } from '../lib/closing.js';
import { rejectBadRequest } from '../lib/request-guard.js';

// Avaliação da revelação (nota 1-5 + comentário opcional). Persiste a nota, o
// texto e a localidade grosseira (país/região/cidade, dos cabeçalhos de geo do
// Vercel) — sem IP e sem nada que identifique o usuário.
export default async function handler(req, res) {
  // Só POST da própria origem (ver lib/request-guard.js).
  if (rejectBadRequest(req, res)) return;
  // Hackathon encerrado: não grava mais nada (ver lib/closing.js).
  if (rejectIfClosed(res)) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = req.body || {};
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ ok: false, error: 'invalid_rating' });
      return;
    }

    // Comentário é opcional: texto aparado e limitado a 500 caracteres.
    let comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : '';
    if (!comment) comment = null;

    // Caminho que levou à revelação: 'form' (caiu na isca) ou 'timeout' (o
    // cronômetro esgotou e a revelação apareceu). Qualquer outro valor vira nulo.
    const path = body.path === 'form' || body.path === 'timeout' ? body.path : null;

    // Localidade de quem avaliou, como em /api/hit.
    const country = req.headers['x-vercel-ip-country'] || null;
    const region = req.headers['x-vercel-ip-country-region'] || null;
    let city = req.headers['x-vercel-ip-city'] || null;
    if (city) {
      try { city = decodeURIComponent(city); } catch (e) { /* mantém como veio */ }
    }

    await supabase.from('feedback').insert({
      rating,
      comment,
      path,
      country,
      region,
      city,
      created_at: new Date().toISOString(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false });
  }
}
