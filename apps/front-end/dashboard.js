(() => {
  const el = (id) => document.getElementById(id);
  let sb = null;
  let accessToken = null;
  let metricsLatency = null;

  init();

  async function init() {
    try {
      const cfg = await fetch('/api/config').then((r) => r.json());
      if (!cfg.url || !cfg.anonKey) throw new Error('config');
      sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    } catch (e) {
      el('note').textContent =
        'Configuração de login indisponível. Falta SUPABASE_URL / SUPABASE_ANON_KEY no ambiente?';
      return;
    }

    el('loginForm').addEventListener('submit', onLogin);
    el('logout').addEventListener('click', onLogout);
    el('obsRefresh').addEventListener('click', () => loadObservability(false));
    el('obsWrite').addEventListener('click', () => loadObservability(true));

    const { data } = await sb.auth.getSession();
    if (data && data.session) showAuthed(data.session);
    else showLogin();
  }

  function showLogin() {
    el('login').classList.remove('hidden');
    el('content').classList.add('hidden');
  }

  async function onLogin(e) {
    e.preventDefault();
    el('loginError').textContent = '';
    el('loginBtn').disabled = true;
    const email = el('email').value.trim();
    const password = el('password').value;
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        el('loginError').textContent = 'E-mail ou senha inválidos.';
        return;
      }
      showAuthed(data.session);
    } finally {
      el('loginBtn').disabled = false;
    }
  }

  async function onLogout() {
    await sb.auth.signOut();
    accessToken = null;
    el('whoami').textContent = '';
    el('email').value = '';
    el('password').value = '';
    el('note').textContent = '';
    showLogin();
  }

  function showAuthed(session) {
    accessToken = session.access_token;
    el('login').classList.add('hidden');
    el('content').classList.remove('hidden');
    el('whoami').textContent = (session.user && session.user.email) || '';
    loadMetrics();
    loadObservability(false);
  }

  // ---- Métricas de negócio ----
  function loadMetrics() {
    const t0 = performance.now();
    fetch('/api/metrics', { headers: { Authorization: 'Bearer ' + accessToken } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error('unauthorized');
        return r.json();
      })
      .then((data) => {
        metricsLatency = Math.round(performance.now() - t0);
        el('accesses').textContent = data.accesses || 0;
        el('submissions').textContent = data.submissions || 0;
        renderLocations(data.locations || []);
      })
      .catch((err) => {
        el('note').textContent =
          err.message === 'unauthorized'
            ? 'Sua conta não tem acesso ao painel.'
            : 'Não foi possível carregar as métricas.';
      });
  }

  // ---- Localização dos acessos ----
  function renderLocations(locations) {
    const box = el('locations');
    if (!box) return;
    if (!locations.length) {
      box.innerHTML = '<p class="muted">Nenhum acesso ainda.</p>';
      return;
    }
    const max = Math.max(1, ...locations.map((l) => l.count));
    box.innerHTML = locations
      .map((l) => {
        const place = [l.city, l.region, l.country].filter(Boolean).join(', ') || '—';
        const pct = Math.round((l.count / max) * 100);
        return (
          '<div class="loc-row">' +
          '<span class="loc-place">' + esc(place) + '</span>' +
          '<span class="loc-bar"><span class="loc-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="loc-count">' + l.count + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  // ---- Observabilidade / diagnóstico ----
  function loadObservability(write) {
    el('obsRows').innerHTML = '<p class="muted">Carregando…</p>';
    const url = '/api/debug' + (write ? '?write=1' : '');
    const t0 = performance.now();
    fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
      .then((r) => r.json())
      .then((d) => renderObs(d, Math.round(performance.now() - t0)))
      .catch(() => {
        el('obsRows').innerHTML = '<p class="muted">Falha ao carregar o diagnóstico.</p>';
      });
  }

  function renderObs(d, latency) {
    const rows = [];
    const envOk = !!(d.env && d.env.SUPABASE_URL && d.serviceKey && d.serviceKey.present && d.anonKey && d.anonKey.present);
    const dbOk = !!(d.hits && !d.hits.error && typeof d.hits.count === 'number');
    const svc = d.serviceKey || {};
    const svcLabel = svc.present ? (svc.type || '—') + (svc.role ? ' · ' + svc.role : '') : 'ausente';

    rows.push(row(dbOk, 'Banco de dados', dbOk ? 'Conectado' : ((d.hits && d.hits.error) || 'erro')));
    rows.push(row(envOk, 'Variáveis de ambiente', envOk ? 'URL, service e anon presentes' : 'faltando variável'));
    rows.push(row(!!svc.present, 'Chave de serviço', svcLabel));

    if (d.insertHit && typeof d.insertHit === 'object') {
      rows.push(row(d.insertHit.ok, 'Escrita (insert)', d.insertHit.ok ? 'OK' : (d.insertHit.error || 'falhou')));
    } else {
      rows.push(rowNeutral('Escrita (insert)', 'não testada — use "Testar escrita"'));
    }

    rows.push(rowNeutral('Latência /api/debug', latency + ' ms'));
    if (metricsLatency != null) rows.push(rowNeutral('Latência /api/metrics', metricsLatency + ' ms'));

    el('obsRows').innerHTML = rows.join('');
    el('obsJson').textContent = JSON.stringify(d, null, 2);
  }

  function row(good, label, value) {
    return (
      '<div class="obs-row"><span class="dot ' + (good ? 'dot-ok' : 'dot-bad') + '"></span>' +
      '<span class="obs-label">' + esc(label) + '</span>' +
      '<span class="obs-val">' + esc(value) + '</span></div>'
    );
  }
  function rowNeutral(label, value) {
    return (
      '<div class="obs-row"><span class="dot dot-neutral"></span>' +
      '<span class="obs-label">' + esc(label) + '</span>' +
      '<span class="obs-val">' + esc(value) + '</span></div>'
    );
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
