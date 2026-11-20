import { createHash } from 'node:crypto';
import { supabase } from '../lib/supabase.js';

// Salt do hash do IP. Mantém o hash não-reversível (contra tabela arco-íris).
// Pode ser sobrescrito por env; o essencial é que o IP em si NUNCA é guardado.
const IP_SALT = process.env.IP_HASH_SALT || 'agenteinvader-siscritico-dedup';

// Deriva um hash não-reversível do IP do cliente, usado APENAS para deduplicar.
// O IP não é salvo em lugar nenhum. Retorna null quando não dá para obter o IP.
function clientIpHash(req) {
  const xff = req.headers['x-forwarded-for'] || '';
  const ip = xff.split(',')[0].trim() || req.headers['x-real-ip'] || '';
  if (!ip) return null;
  return createHash('sha256').update(IP_SALT + ip).digest('hex');
}

// Nº de campos corretos válido: inteiro 0–4, senão nulo. É só isso que o
// navegador manda — a comparação com os dados do PDF é feita lá, e o conteúdo
// digitado nunca chega aqui.
function correctCount(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  return n;
}

// Conta UM clique no botão "Confirmar" do formulário de simulação.
// IMPORTANTE: não recebe o CONTEÚDO do que foi digitado — só quantos dos 4
// campos batiam com os dados do PDF (0 a 4), para ver quem preencheu com os
// dados do PDF. E conta no máximo uma vez por IP: cliques repetidos da mesma
// pessoa não inflam as métricas.
export default async function handler(req, res) {
  try {
    const ipHash = clientIpHash(req);
    const correct = correctCount(req.body && req.body.correct);

    // upsert com ignoreDuplicates => INSERT ... ON CONFLICT (ip_hash) DO NOTHING.
    // O 2º clique do mesmo IP bate no índice único e é ignorado, sem erro.
    await supabase
      .from('form_submissions')
      .upsert(
        {
          ip_hash: ipHash,
          created_at: new Date().toISOString(),
          correct_count: correct,
        },
        { onConflict: 'ip_hash', ignoreDuplicates: true },
      );

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false });
  }
}
