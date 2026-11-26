// Guards simples para as rotas de ESCRITA (/api/hit, /submit, /event, /feedback).
// COMPLEMENTAM o controle de data (lib/closing.js); não o substituem. Depois do
// encerramento, quem barra a gravação continua sendo o rejectIfClosed.
//
// O que fazem:
//  - exigem método POST (as 4 rotas são chamadas por fetch POST no front);
//  - exigem mesma origem: Origin (ou, na falta, Referer) precisa bater com o
//    host da requisição. Bloqueia chamadas feitas pelo JS de OUTRO site.
//
// O que NÃO fazem (importante não superestimar): parar um atacante que monta a
// requisição crua (curl, script, Postman). Ele pode omitir o Origin ou forjá-lo.
// Contra isso o caminho é validar o token do Turnstile no servidor e/ou aplicar
// rate limit — fica de fora desta mudança de propósito.

// Extrai o host de uma URL (Origin/Referer). Vazio se não for URL válida.
function hostOf(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch (e) {
    return '';
  }
}

// Host "real" da requisição atrás do proxy do Vercel. Serve para comparar sem
// precisar fixar o domínio no código (funciona em produção, preview e local).
function requestHost(req) {
  const h = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(h).toLowerCase();
}

// Garante POST. Responde 405 e devolve true quando o método é outro.
export function rejectBadMethod(req, res) {
  if (req.method === 'POST') return false;
  res.setHeader('Allow', 'POST');
  res.setHeader('Cache-Control', 'no-store');
  res.status(405).json({ ok: false, error: 'method_not_allowed' });
  return true;
}

// Garante mesma origem. Responde 403 e devolve true quando a origem não bate.
// Sem Origin e sem Referer não há o que comparar: deixa passar (há navegadores
// e políticas de privacidade que não enviam esses cabeçalhos), porque a
// proteção que importa está no controle de data e no captcha, não aqui.
export function rejectCrossOrigin(req, res) {
  const claimed = hostOf(req.headers.origin || '') || hostOf(req.headers.referer || '');
  const self = requestHost(req);
  if (!self || !claimed) return false; // nada para comparar
  if (claimed === self) return false; // mesma origem: segue
  res.setHeader('Cache-Control', 'no-store');
  res.status(403).json({ ok: false, error: 'bad_origin' });
  return true;
}

// Atalho: aplica os dois guards na ordem certa. Retorna true se já respondeu
// (o handler deve dar `return`), false se a requisição pode seguir.
export function rejectBadRequest(req, res) {
  return rejectBadMethod(req, res) || rejectCrossOrigin(req, res);
}
