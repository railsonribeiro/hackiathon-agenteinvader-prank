(() => {
  const el = (id) => document.getElementById(id);
  let sb = null;
  let accessToken = null;
  let locData = { country: [], state: [], city: [] };
  let locLevel = 'state'; // padrão: estado

  init();

  async function init() {
    // Link "ver a página" aponta para o host da isca. No host admin, "/" é
    // redirecionado de volta ao dashboard, então trocamos admin. -> siscritico.
    const simLink = el('simLink');
    if (simLink) {
      const h = location.hostname;
      simLink.href = h.indexOf('admin.') === 0
        ? location.protocol + '//' + h.replace(/^admin\./, 'siscritico.') + '/'
        : '/';
    }

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

    // Toggle de nível da localização (País / Estado / Cidade).
    const toggle = el('locToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        locLevel = btn.dataset.level;
        Array.from(toggle.querySelectorAll('.seg-btn')).forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        renderLocations();
      });
    }

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
  }

  // ---- Métricas de negócio ----
  function loadMetrics() {
    fetch('/api/metrics', { headers: { Authorization: 'Bearer ' + accessToken } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error('unauthorized');
        return r.json();
      })
      .then((data) => {
        el('accesses').textContent = data.accesses || 0;
        el('submissions').textContent = data.submissions || 0;
        renderFunnel(data.funnel || []);
        renderFeedback(data.feedback || null);
        const loc = data.locations || {};
        locData = {
          country: loc.country || [],
          state: loc.state || [],
          city: loc.city || [],
        };
        renderLocations();
      })
      .catch((err) => {
        el('note').textContent =
          err.message === 'unauthorized'
            ? 'Sua conta não tem acesso ao painel.'
            : 'Não foi possível carregar as métricas.';
      });
  }

  // ---- Funil de conversão ----
  function renderFunnel(stages) {
    const box = el('funnel');
    if (!box) return;
    if (!stages.length) {
      box.innerHTML = '<p class="muted">Sem dados ainda.</p>';
      return;
    }
    const top = Math.max(1, Number(stages[0].count) || 0);
    box.innerHTML = stages
      .map((s, i) => {
        const count = Number(s.count) || 0;
        // Largura relativa ao topo do funil (aberturas).
        const pct = Math.min(100, Math.round((count / top) * 100));
        // Conversão: o servidor manda 'base' (sobre qual número a etapa converte,
        // por causa dos dois caminhos até a revelação); sem ela, usa a etapa acima.
        const base = s.base != null ? Number(s.base) : (i > 0 ? Number(stages[i - 1].count) || 0 : null);
        const step = base && base > 0 ? Math.min(100, Math.round((count / base) * 100)) : null;
        const baseLabel = s.baseLabel ? ' ' + s.baseLabel : ' da etapa anterior';
        const stepTag = step != null ? '<span class="fn-step">' + step + '%' + esc(baseLabel) + '</span>' : '';
        return (
          '<div class="fn-row">' +
          '<div class="fn-top"><span class="fn-label">' + esc(s.label) + '</span>' +
          '<span class="fn-count">' + count + '</span></div>' +
          '<span class="fn-bar"><span class="fn-fill" style="width:' + pct + '%"></span></span>' +
          stepTag +
          '</div>'
        );
      })
      .join('');
  }

  // ---- Avaliações da simulação ----
  function renderFeedback(fb) {
    const box = el('feedback');
    if (!box) return;
    if (!fb || !fb.count) {
      box.innerHTML = '<p class="muted">Nenhuma avaliação ainda.</p>';
      return;
    }
    const starsOf = (n) => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);

    // Resumo: média + total.
    let html =
      '<div class="fb-summary">' +
      '<span class="fb-avg">' + fb.avg.toFixed(1) + '</span>' +
      '<span class="fb-avg-stars">' + starsOf(Math.round(fb.avg)) + '</span>' +
      '<span class="fb-total">' + fb.count + (fb.count === 1 ? ' avaliação' : ' avaliações') + '</span>' +
      '</div>';

    // Quem avaliou caiu na isca ou não? (quando houver o dado).
    const bp = fb.byPath || {};
    const fell = Number(bp.form || 0);
    const safe = Number(bp.timeout || 0);
    if (fell || safe) {
      html +=
        '<div class="fb-paths">' +
        '<span class="fb-tag fb-tag-fell">Caiu na isca: ' + fell + '</span>' +
        '<span class="fb-tag fb-tag-safe">Não caiu: ' + safe + '</span>' +
        '</div>';
    }

    // Distribuição 5★ -> 1★.
    const dist = fb.distribution || {};
    const maxBar = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => Number(dist[n] || 0)));
    html += '<div class="fb-dist">';
    for (let n = 5; n >= 1; n--) {
      const c = Number(dist[n] || 0);
      const pct = Math.round((c / maxBar) * 100);
      html +=
        '<div class="fb-dist-row">' +
        '<span class="fb-dist-lbl">' + n + '★</span>' +
        '<span class="loc-bar"><span class="loc-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="fb-dist-count">' + c + '</span>' +
        '</div>';
    }
    html += '</div>';

    // Comentários recentes.
    const comments = fb.comments || [];
    if (comments.length) {
      html += '<div class="fb-comments"><p class="fb-comments-title">Comentários</p>';
      html += comments
        .map((c) => (
          '<div class="fb-comment">' +
          '<span class="fb-comment-stars">' + starsOf(c.rating) + '</span>' +
          '<span class="fb-comment-body">' +
          '<span class="fb-comment-head">' + fbPathTag(c) + '<span class="fb-comment-text">' + esc(c.comment) + '</span></span>' +
          fbPlace(c) +
          '</span>' +
          '</div>'
        ))
        .join('');
      html += '</div>';
    }

    box.innerHTML = html;
  }

  // Selo do caminho: caiu na isca (form) ou não caiu (timeout); avaliações
  // anteriores a esta coleta não têm caminho (sem selo).
  function fbPathTag(c) {
    if (c.path === 'form') return '<span class="fb-tag fb-tag-fell">Caiu na isca</span>';
    if (c.path === 'timeout') return '<span class="fb-tag fb-tag-safe">Não caiu</span>';
    return '';
  }

  // Localidade de quem avaliou (cidade, estado, país); avaliações anteriores à
  // coleta não têm localidade.
  function fbPlace(c) {
    const place = [c.city, c.region, c.country].filter(Boolean).join(', ');
    return place
      ? '<span class="fb-comment-place">📍 ' + esc(place) + '</span>'
      : '<span class="fb-comment-place is-empty">Localidade não registrada</span>';
  }

  // ---- Localização dos acessos (País / Estado / Cidade) ----
  function locLabel(l, level) {
    if (level === 'country') return l.country || '—';
    if (level === 'state') return [l.region, l.country].filter(Boolean).join(' · ') || '—';
    return [l.city, l.region, l.country].filter(Boolean).join(', ') || '—';
  }

  function renderLocations() {
    const box = el('locations');
    if (!box) return;
    const rows = locData[locLevel] || [];
    if (!rows.length) {
      box.innerHTML = '<p class="muted">Nenhum acesso ainda.</p>';
      return;
    }
    const max = Math.max(1, ...rows.map((l) => l.count));
    box.innerHTML = rows
      .map((l) => {
        const place = locLabel(l, locLevel);
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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
