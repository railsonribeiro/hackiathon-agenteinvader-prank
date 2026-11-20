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

// Nº de caracteres válido: inteiro 0–64, senão nulo. NUNCA o conteúdo do campo,
// só o tamanho — uma contagem não identifica ninguém.
function len(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(64, Math.round(n));
}

// Conta UM clique no botão "Confirmar" do formulário de simulação.
// IMPORTANTE: não recebe nem guarda o CONTEÚDO do que foi digitado — só quantos
// caracteres foram digitados em cada campo (para ver quem preencheu com os dados
// do PDF). E conta no máximo uma vez por IP: cliques repetidos da mesma pessoa
// não inflam as métricas.
export default async function handler(req, res) {
  try {
    const ipHash = clientIpHash(req);
    const lengths = (req.body && req.body.lengths) || {};

    // upsert com ignoreDuplicates => INSERT ... ON CONFLICT (ip_hash) DO NOTHING.
    // O 2º clique do mesmo IP bate no índice único e é ignorado, sem erro.
    await supabase
      .from('form_submissions')
      .upsert(
        {
          ip_hash: ipHash,
          created_at: new Date().toISOString(),
          cracha_len: len(lengths.cracha),
          placa_len: len(lengths.placa),
          sala_len: len(lengths.sala),
          pedido_len: len(lengths.pedido),
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
