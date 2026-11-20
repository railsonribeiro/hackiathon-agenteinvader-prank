import { supabase } from '../lib/supabase.js';

// Avaliação da revelação (nota 1-5 + comentário opcional). Persiste só a nota e
// o texto — sem IP e sem nada que identifique o usuário.
export default async function handler(req, res) {
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

    await supabase.from('feedback').insert({
      rating,
      comment,
      created_at: new Date().toISOString(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false });
  }
}
