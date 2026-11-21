// Devolve as credenciais PÚBLICAS do Supabase para o navegador iniciar o login.
// A chave anon/publishable é projetada para ser exposta ao cliente.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '',
    // Site key PÚBLICA do Cloudflare Turnstile (CAPTCHA do login). Vazia = sem
    // CAPTCHA (o login funciona normal). A chave secreta fica só no Supabase.
    captchaSiteKey: process.env.TURNSTILE_SITE_KEY || '',
  });
}
