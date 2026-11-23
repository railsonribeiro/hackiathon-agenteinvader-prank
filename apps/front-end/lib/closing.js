// Encerramento da simulação.
//
// O Hackathon termina em 25/11/2026 às 23h59min59 (horário de Brasília). A partir
// daí não faz mais sentido manter a isca no ar: a página "/" passa a mostrar
// /encerrado e as APIs que gravam dados (/api/hit, /api/submit, /api/event,
// /api/feedback) deixam de gravar. O painel (/dashboard e /api/metrics)
// continua funcionando normalmente, com os dados coletados até ali.
//
// Usado pelo Edge Middleware e pelas funções /api — por isso sem dependências
// de Node (só Date e process.env, que existem nos dois runtimes).
//
// Para testar ou adiar sem novo deploy de código, defina a variável de ambiente
// SIMULATION_CLOSES_AT no Vercel com uma data ISO 8601 com fuso, por exemplo
// "2026-11-25T23:59:59-03:00" (e faça Redeploy). Valor inválido é ignorado.
export const DEFAULT_CLOSES_AT = '2026-11-25T23:59:59-03:00';

function readEnv() {
  try {
    return (typeof process !== 'undefined' && process.env && process.env.SIMULATION_CLOSES_AT) || '';
  } catch (e) {
    return '';
  }
}

export function closesAt() {
  const fromEnv = Date.parse(readEnv());
  if (Number.isFinite(fromEnv)) return fromEnv;
  return Date.parse(DEFAULT_CLOSES_AT);
}

export function isClosed(now = Date.now()) {
  return now >= closesAt();
}

// Resposta padrão das APIs de escrita depois do encerramento: 410 Gone, sem
// tocar o banco. O front já ignora a resposta dessas chamadas.
export function rejectIfClosed(res) {
  if (!isClosed()) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).json({ ok: false, error: 'simulation_closed' });
  return true;
}
