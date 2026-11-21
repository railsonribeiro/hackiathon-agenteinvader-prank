import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Devolve as métricas agregadas para o painel.
// Exige um usuário válido do Supabase: o cliente envia o token (JWT) no header
// Authorization, e aqui ele é validado no servidor. Qualquer usuário cadastrado
// no projeto Supabase tem acesso.
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData || !userData.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    // Acesso liberado para qualquer usuário cadastrado no Supabase.
    // (Para restringir, dá para checar userData.user.email aqui.)
  } catch (e) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  try {
    const [accessRes, submitRes, countryRes, regionRes, cityRes, funnelRes, fbStatsRes, fbRowsRes, fillRes] = await Promise.all([
      supabase.from('hits').select('*', { count: 'exact', head: true }),
      supabase.from('form_submissions').select('*', { count: 'exact', head: true }),
      supabase.from('hits_by_country').select('*').limit(100),
      supabase.from('hits_by_region').select('*').limit(100),
      supabase.from('hits_by_location').select('*').limit(100),
      supabase.from('funnel_counts').select('*'),
      supabase.from('feedback_stats').select('*').single(),
      supabase.from('feedback').select('rating, comment, path, country, region, city, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('submission_fill').select('*').single(),
    ]);

    // Localização em três níveis (o painel troca entre eles; padrão: estado).
    const locations = {
      country: (countryRes.data || []).map((r) => ({
        country: r.country || '—',
        count: Number(r.count || 0),
      })),
      state: (regionRes.data || []).map((r) => ({
        country: r.country || '—',
        region: r.region || '',
        count: Number(r.count || 0),
      })),
      city: (cityRes.data || []).map((r) => ({
        country: r.country || '—',
        region: r.region || '',
        city: r.city || '',
        count: Number(r.count || 0),
      })),
    };

    const accesses = Number(accessRes.count || 0);
    const submissions = Number(submitRes.count || 0);

    // "Caíram na simulação" = clique em "Confirmar" (form_submissions), que
    // leva direto à revelação e já tem histórico. Só 'timeout' é evento novo.
    const stageCount = {};
    (funnelRes.data || []).forEach((r) => { stageCount[r.stage] = Number(r.count || 0); });

    // Feedback: total, média, distribuição das notas e comentários recentes.
    const fbRows = fbRowsRes.data || [];
    const fbCount = Number((fbStatsRes.data && fbStatsRes.data.count) || fbRows.length || 0);
    const fbAvg = Number((fbStatsRes.data && fbStatsRes.data.avg_rating) || 0);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    fbRows.forEach((r) => { const n = Number(r.rating); if (distribution[n] != null) distribution[n] += 1; });
    // Quantas avaliações vieram de quem caiu (form) e de quem não caiu (timeout).
    // Contado sobre as avaliações carregadas (as mais recentes), como a distribuição.
    const byPath = { form: 0, timeout: 0, unknown: 0 };
    fbRows.forEach((r) => {
      if (r.path === 'form') byPath.form += 1;
      else if (r.path === 'timeout') byPath.timeout += 1;
      else byPath.unknown += 1;
    });
    const comments = fbRows
      .filter((r) => r.comment)
      .slice(0, 50)
      .map((r) => ({
        rating: Number(r.rating),
        comment: r.comment,
        path: r.path || '',
        country: r.country || '',
        region: r.region || '',
        city: r.city || '',
        created_at: r.created_at,
      }));

    // Dois caminhos levam à revelação: cair no formulário (submissions) ou
    // deixar o cronômetro esgotar (timeout). 'base' diz sobre qual número a %
    // de cada etapa é calculada no painel — senão "oficial" sairia relativo só
    // ao ramo acima dele, o que confunde.
    const timeouts = stageCount.timeout || 0;
    const reachedReveal = submissions + timeouts;
    // Quem clicou em "Confirmar" (todos caíram) se divide em: preencheu os
    // campos, clicou sem preencher nada, ou sem medição (envio anterior à
    // coleta de filled_count). Sub-etapas, com % sobre quem caiu.
    const f = fillRes.data || {};
    const fellFilled = Number(f.filled || 0);
    const fellEmpty = Number(f.empty || 0);
    const fellUnknown = Number(f.fill_unknown || 0);
    const fellBase = { base: submissions, baseLabel: 'dos que caíram', sub: true };

    const funnel = [
      { key: 'open', label: 'Abriram a página', count: accesses },
      { key: 'reveal', label: 'Clicaram em Confirmar — caíram no phishing', count: submissions, base: accesses, baseLabel: 'dos que abriram' },
      { key: 'fell_filled', label: 'Preencheram os campos', count: fellFilled, ...fellBase },
      { key: 'fell_empty', label: 'Clicaram sem preencher nada', count: fellEmpty, ...fellBase },
    ];
    if (fellUnknown > 0) {
      funnel.push({ key: 'fell_unknown', label: 'Sem medição (envios antigos)', count: fellUnknown, ...fellBase });
    }
    funnel.push(
      { key: 'timeout', label: 'Não preencheram — viram a revelação ao esgotar o tempo', count: timeouts, base: accesses, baseLabel: 'dos que abriram' },
      { key: 'feedback', label: 'Avaliaram a simulação', count: fbCount, base: reachedReveal, baseLabel: 'dos que viram a revelação' },
    );

    // Preenchimento com os dados do PDF: só quantos campos bateram (0..4) por
    // envio. Nenhum valor digitado é guardado.
    const answered = Number(f.answered || 0);
    const correctSum = Number(f.correct_sum || 0);
    const fill = {
      total: Number(f.total || 0),
      answered,
      allOk: Number(f.c4 || 0),
      // Média de campos corretos por envio (0..4) e em %.
      avg: answered ? correctSum / answered : 0,
      avgPct: answered ? Math.round((correctSum / (answered * 4)) * 100) : 0,
      distribution: {
        0: Number(f.c0 || 0),
        1: Number(f.c1 || 0),
        2: Number(f.c2 || 0),
        3: Number(f.c3 || 0),
        4: Number(f.c4 || 0),
      },
    };

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      accesses,
      submissions,
      locations,
      funnel,
      feedback: { count: fbCount, avg: fbAvg, distribution, byPath, comments },
      fill,
    });
  } catch (err) {
    res.status(500).json({ error: 'metrics_unavailable' });
  }
}
