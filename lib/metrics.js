import { Redis } from '@upstash/redis';

// Aceita tanto as variáveis diretas do Upstash quanto as criadas pela
// integração do Vercel ("KV_*"). Assim funciona nos dois modos de conexão.
const url =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const redis = new Redis({ url, token });

// Retorna a data (YYYY-MM-DD) no fuso de São Paulo, para o dashboard
// bater com o dia local de quem está acompanhando.
export function spDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
