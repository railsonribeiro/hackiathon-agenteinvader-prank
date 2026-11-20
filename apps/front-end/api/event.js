import { supabase } from '../lib/supabase.js';

// Estágios do funil aceitos (os posteriores ao clique em "Confirmar").
//   timeout  -> o cronômetro de urgência esgotou e a revelação apareceu sem o
//               usuário preencher o formulário (ele não "caiu")
//   official -> clicou no link oficial do hackathon, na revelação
// Obs.: "chegou na revelação" pelo formulário NÃO é registrado aqui — é o
// próprio clique em "Confirmar" (/api/submit), que já tem histórico.
const STAGES = new Set(['timeout', 'official']);

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
