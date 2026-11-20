import { supabase } from '../lib/supabase.js';

// Estágios do funil aceitos (os posteriores à abertura/preenchimento).
//   reveal   -> chegou na tela de revelação
//   official -> clicou no link oficial do hackathon
const STAGES = new Set(['reveal', 'official']);

// Registra UMA passagem por um estágio do funil. Agregado: grava só qual etapa
// foi atingida. Sem IP, sem cookie, sem nada que identifique o usuário.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const stage = (req.body && req.body.stage) || '';
    if (!STAGES.has(stage)) {
      res.status(400).json({ ok: false, error: 'invalid_stage' });
      return;
    }
    await supabase.from('funnel_events').insert({
      stage,
      created_at: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false });
  }
}
