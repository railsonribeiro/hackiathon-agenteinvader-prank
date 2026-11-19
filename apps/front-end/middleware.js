// Edge Middleware: roda ANTES do filesystem. No host do subdomínio admin,
// manda a raiz "/" para o dashboard. (Rewrites do vercel.json são fallback e
// não funcionam aqui, porque "/" já casa com o index.html da simulação.)
export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'admin.agenteinvader.com.br') {
    const url = new URL(request.url);
    url.pathname = '/dashboard';
    return Response.redirect(url.toString(), 307);
  }
  // Demais hosts (ex.: siscritico): segue normal → página da simulação.
}
