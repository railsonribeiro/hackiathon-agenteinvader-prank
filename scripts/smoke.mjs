// Teste de fumaça: usa a MESMA role das funções /api (service_role) para gravar
// e ler cada tabela/view. Pega regressões de GRANT/RLS (como a do PR #14, em que
// o INSERT falhava em silêncio por falta de privilégio) antes de ir pra produção.
//
// Espera SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente. No CI, apontam
// para um Supabase LOCAL (supabase start) — não toca produção.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const now = () => new Date().toISOString();
const tag = 'ci-smoke-' + Date.now();

let failed = false;
const okMsg = (m) => console.log('  ok  ' + m);
const failMsg = (m, e) => {
  console.error('  XX  ' + m + ' -> ' + (e && e.message ? e.message : e));
  failed = true;
};

async function ins(table, row) {
  const { error } = await sb.from(table).insert(row);
  if (error) failMsg('insert ' + table, error);
  else okMsg('insert ' + table);
}
async function sel(rel) {
  const { error } = await sb.from(rel).select('*').limit(1);
  if (error) failMsg('select ' + rel, error);
  else okMsg('select ' + rel);
}

console.log('Escrita (service_role precisa de GRANT em cada tabela):');
await ins('hits', { created_at: now(), country: 'BR', region: 'SP', city: 'CI' });
await ins('form_submissions', { created_at: now(), ip_hash: tag });
await ins('funnel_events', { created_at: now(), stage: 'official' });
await ins('feedback', { created_at: now(), rating: 5, comment: tag, country: 'BR', region: 'SP', city: 'CI' });

console.log('Leitura (tabelas + views usadas pelo /api/metrics):');
for (const rel of [
  'hits',
  'form_submissions',
  'funnel_events',
  'feedback',
  'hits_by_location',
  'hits_by_country',
  'hits_by_region',
  'funnel_counts',
  'feedback_stats',
]) {
  await sel(rel);
}

if (failed) {
  console.error('\nSmoke test FALHOU — provável GRANT/permissão faltando (ver as migrations 20261119030000 e 20261120060000).');
  process.exit(1);
}
console.log('\nSmoke test OK — service_role grava e lê todas as tabelas e views.');
