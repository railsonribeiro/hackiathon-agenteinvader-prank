import { isClosed } from './lib/closing.js';

// Edge Middleware: roda ANTES do filesystem.
// - No host do subdomínio admin, manda a raiz "/" para o dashboard. (Rewrites
//   do vercel.json são fallback e não funcionam aqui, porque "/" já casa com o
//   index.html da simulação.)
// - Nos demais hosts (ex.: siscritico), depois do encerramento do Hackathon
//   (ver lib/closing.js), a isca sai do ar: "/" vai para /encerrado.
export const config = {
  matcher: ['/', '/index.html'],
};

function redirect(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.toString(),
      // Temporário e sem cache: se a data for ajustada, ninguém fica preso.
      'Cache-Control': 'no-store',
    },
  });
}

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'admin.agenteinvader.com.br') {
    return redirect(request, '/dashboard');
  }
  if (isClosed()) {
    return redirect(request, '/encerrado');
  }
  // Simulação ainda aberta: segue normal → página da simulação.
}
