// Edge Middleware do Vercel: exige login (HTTP Basic) no painel de métricas
// e na API que o alimenta. Usuário e senha vêm das variáveis de ambiente
// DASHBOARD_USER e DASHBOARD_PASSWORD.

export const config = {
  matcher: ['/dashboard', '/dashboard.html', '/api/metrics'],
};

export default function middleware(req) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  // Sem credenciais configuradas, não bloqueia (conveniência em dev).
  // Em produção, defina as duas variáveis para exigir login.
  if (!user || !pass) return;

  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(':');
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === pass) {
        return; // autorizado — segue para a página/API normalmente
      }
    } catch (e) {
      // credencial malformada cai no 401 abaixo
    }
  }

  return new Response('Autenticação necessária.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Painel de métricas", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
