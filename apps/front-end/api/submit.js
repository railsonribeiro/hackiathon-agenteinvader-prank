import { supabase } from '../lib/supabase.js';

// Conta UM clique no botão "Confirmar" do formulário de simulação.
// IMPORTANTE: não recebe, não lê e não guarda nada do que foi digitado —
// registra apenas que alguém clicou em confirmar.
export default async function handler(req, res) {
  try {
    await supabase.from('form_submissions').insert({ created_at: new Date().toISOString() });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
