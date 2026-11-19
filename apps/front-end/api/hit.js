import { supabase } from '../lib/supabase.js';

// Conta UM acesso (abertura da página). Não coleta nenhum dado do usuário.
export default async function handler(req, res) {
  try {
    await supabase.from('hits').insert({ created_at: new Date().toISOString() });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
