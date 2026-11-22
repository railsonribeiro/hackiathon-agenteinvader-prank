(() => {
  const el = (id) => document.getElementById(id);
  let sb = null;
  let accessToken = null;
  let locData = { country: [], state: [], city: [] };
  let locLevel = 'state';

  let siteKey = '';
  let captchaToken = '';
  let captchaWidgetId = null;

  function renderCaptcha() {
    if (!siteKey || !window.turnstile || captchaWidgetId !== null) return;
    const box = el('turnstileBox');
    if (!box) return;
    try {
      captchaWidgetId = window.turnstile.render(box, {
        sitekey: siteKey,
        callback: (t) => { captchaToken = t; },
        'expired-callback': () => { captchaToken = ''; },
        'error-callback': () => { captchaToken = ''; },
      });
    } catch (e) { }
  }

  function resetCaptcha() {
    captchaToken = '';
    if (window.turnstile && captchaWidgetId !== null) {
      try { window.turnstile.reset(captchaWidgetId); } catch (e) { }
    }
  }

  window.onloadTurnstileCallback = renderCaptcha;

  init();

  async function init() {
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
      siteKey = cfg.captchaSiteKey || '';
    } catch (e) {
      el('note').textContent =
        'Configuração de login indisponível. Falta SUPABASE_URL / SUPABASE_ANON_KEY no ambiente?';
      return;
    }

    renderCaptcha();

    el('loginForm').addEventListener('submit', onLogin);
    el('logout').addEventListener('click', onLogout);

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
    if (siteKey && !captchaToken) {
      el('loginError').textContent = 'Confirme que você não é um robô.';
      return;
    }
    el('loginBtn').disabled = true;
    const email = el('email').value.trim();
    const password = el('password').value;
    try {
      const options = siteKey ? { captchaToken } : {};
      const { data, error } = await sb.auth.signInWithPassword({ email, password, options });
      if (error) {
        el('loginError').textContent = 'E-mail ou senha inválidos.';
        resetCaptcha();
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
    resetCaptcha();
    showLogin();
  }

  function showAuthed(session) {
    accessToken = session.access_token;
    el('login').classList.add('hidden');
    el('content').classList.remove('hidden');
    el('whoami').textContent = (session.user && session.user.email) || '';
    loadMetrics();
  }

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
        renderFill(data.fill || null);
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



  const FN_PATHS = ['clicked_filled', 'clicked_empty', 'clicked_unknown', 'timeout'];

  const FN_FELL = ['clicked_filled', 'clicked_empty', 'clicked_unknown'];

  const FN_PATH_LABELS = {
    clicked_filled: 'Preencheram ao menos um campo',
    clicked_empty: 'Deixaram todos os campos em branco',
    clicked_unknown: 'Preenchimento não medido (cliques antes de 21/11, 12h)',
  };


  let fnPathsOpen = false;
  const fnHelpBtn = () =>
    '<button type="button" class="fn-help' + (fnPathsOpen ? ' open' : '') + '"' +
    ' aria-expanded="' + fnPathsOpen + '" aria-controls="fnPaths"' +
    ' title="Por qual caminho chegaram à revelação?" aria-label="Por qual caminho chegaram à revelação?">' +
    '<span class="fn-help-q" aria-hidden="true">?</span>' +
    '<span class="fn-help-chev" aria-hidden="true">&#9662;</span>' +
    '</button>';

  function bindFunnelToggle(box) {
    if (box.dataset.toggleBound) return;
    box.dataset.toggleBound = '1';
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.fn-help');
      if (!btn) return;
      const panel = el('fnPaths');
      if (!panel) return;
      fnPathsOpen = !fnPathsOpen;
      panel.hidden = !fnPathsOpen;
      btn.classList.toggle('open', fnPathsOpen);
      btn.setAttribute('aria-expanded', String(fnPathsOpen));
    });
  }

  function renderFunnel(stages) {
    const box = el('funnel');
    if (!box) return;
    bindFunnelToggle(box);
    if (!stages.length) {
      box.innerHTML = '<p class="muted">Sem dados ainda.</p>';
      return;
    }
    const by = {};
    stages.forEach((s) => { by[s.key] = s; });
    const n = (k) => (by[k] ? Number(by[k].count) || 0 : 0);
    const pctOf = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

    const opened = n('open');
    const paths = FN_PATHS.filter((k) => by[k]);
    const revealed = paths.reduce((t, k) => t + n(k), 0);
    const rated = n('feedback');

    const stepHead = (label, count, base, baseLabel, extra) =>
      '<div class="fn-top"><span class="fn-label">' + esc(label) + (extra || '') + '</span>' +
      '<span class="fn-count">' + count + '</span></div>' +
      '<span class="fn-bar"><span class="fn-fill" style="width:' + (base == null ? 100 : pctOf(count, base)) + '%"></span></span>' +
      (base == null ? '' : '<span class="fn-step">' + pctOf(count, base) + '% ' + esc(baseLabel) + '</span>');

    const pathRow = (label, c, base, cls) =>
      '<div class="fn-path' + (cls ? ' ' + cls : '') + '">' +
      '<span class="fn-path-lbl">' + label + '</span>' +
      '<span class="fn-path-num">' + c + '<span class="fn-path-pct">' + pctOf(c, base) + '%</span></span>' +
      '<span class="fn-path-bar"><span class="fn-fill" style="width:' + pctOf(c, base) + '%"></span></span>' +
      '</div>';
    const fellKeys = FN_FELL.filter((k) => by[k]);
    const fell = fellKeys.reduce((t, k) => t + n(k), 0);
    let pathRows = '';
    if (fellKeys.length) {
      pathRows +=
        '<div class="fn-path-group">' +
        pathRow('<strong>Caíram no phishing</strong><span class="fn-path-hint">Clicaram em <em>Confirmar</em> antes de o cronômetro zerar</span>', fell, revealed, 'fn-path-main') +
        '<div class="fn-path-subs">' +
        fellKeys.map((k) => pathRow(esc(FN_PATH_LABELS[k] || by[k].label), n(k), fell, 'fn-path-sub')).join('') +
        '</div></div>';
    }
    if (by.timeout) {
      pathRows += pathRow('<strong>Não caíram no phishing</strong><span class="fn-path-hint">Esperaram o cronômetro zerar</span>', n('timeout'), revealed, 'fn-path-main');
    }

    box.innerHTML =
      '<div class="fn-stair fn-lvl0">' +
      stepHead('Acessos à página', opened, null) +
      '<div class="fn-stair fn-lvl1">' +
      stepHead('Chegaram à tela de revelação', revealed, opened, 'dos acessos', paths.length ? fnHelpBtn() : '') +
      (paths.length
        ? '<div class="fn-paths" id="fnPaths"' + (fnPathsOpen ? '' : ' hidden') + '>' +
          '<div class="fn-paths-title">Por qual caminho</div>' + pathRows + '</div>'
        : '') +
      (by.feedback
        ? '<div class="fn-stair fn-lvl2">' +
          stepHead('Avaliaram a simulação', rated, revealed, 'de quem chegou à revelação') +
          '</div>'
        : '') +
      '</div>' +
      '</div>';
  }

  function renderFill(fill) {
    const box = el('fill');
    if (!box) return;
    const answered = Number(fill && fill.answered) || 0;
    if (!fill || !answered) {
      box.innerHTML = '<p class="muted">Nenhum envio com medição ainda.</p>';
      return;
    }
    const allOk = Number(fill.allOk) || 0;
    const pct = Math.round((allOk / answered) * 100);
    const avgPct = Number(fill.avgPct) || 0;
    const avg = (Number(fill.avg) || 0).toFixed(1).replace('.', ',');

    let html =
      '<p class="pdf-lead"><strong>' + allOk + ' de ' + answered + '</strong> envios medidos ' +
      'acertaram os 4 campos <span class="pdf-lead-pct">(' + pct + '%)</span></p>' +
      '<p class="pdf-sub">Média de ' + avg + ' de 4 campos certos por envio (' + avgPct + '%)</p>';


    const total = Number(fill.total) || 0;
    const semMedicao = total - answered;
    if (semMedicao > 0) {
      html +=
        '<p class="pdf-sub">Medido em ' + answered + ' de ' + total + ' envios &mdash; ' +
        'os ' + semMedicao + ' anteriores a 20/11 (~21h) não têm o dado.</p>';
    }

    const dist = fill.distribution || {};
    html += '<div class="pdf-rows" role="list">';
    for (let n = 4; n >= 0; n--) {
      const c = Number(dist[n] || 0);
      let dots = '';
      for (let i = 0; i < 4; i++) dots += '<span class="pdf-dot' + (i < n ? ' ok' : '') + '"></span>';
      html +=
        '<div class="pdf-row' + (c ? '' : ' empty') + '" role="listitem">' +
        '<span class="pdf-dots" aria-hidden="true">' + dots + '</span>' +
        '<span class="pdf-lbl">' + (n === 1 ? '1 campo certo' : n + ' campos certos') +
        (n === 0 ? '<span class="pdf-hint">errou todos ou deixou em branco</span>' : '') + '</span>' +
        '<span class="pdf-count">' + c + (c === 1 ? ' envio' : ' envios') + '</span>' +
        '</div>';
    }
    html += '</div>';

    box.innerHTML = html;
  }

  function renderFeedback(fb) {
    const box = el('feedback');
    if (!box) return;
    if (!fb || !fb.count) {
      box.innerHTML = '<p class="muted">Nenhuma avaliação ainda.</p>';
      return;
    }
    const starsOf = (n) => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);

    let html =
      '<div class="fb-summary">' +
      '<span class="fb-avg">' + fb.avg.toFixed(1) + '</span>' +
      '<span class="fb-avg-stars">' + starsOf(Math.round(fb.avg)) + '</span>' +
      '<span class="fb-total">' + fb.count + (fb.count === 1 ? ' avaliação' : ' avaliações') + '</span>' +
      '</div>';

    const bp = fb.byPath || {};
    const fell = Number(bp.form || 0);
    const safe = Number(bp.timeout || 0);
    if (fell || safe) {
      html +=
        '<div class="fb-paths">' +
        '<span class="fb-tag fb-tag-fell">Caiu no phishing: ' + fell + '</span>' +
        '<span class="fb-tag fb-tag-safe">Não caiu: ' + safe + '</span>' +
        '</div>';
    }

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

    const comments = fb.comments || [];
    if (comments.length) {
      html += '<div class="fb-comments"><p class="fb-comments-title">Comentários</p>';
      html += comments
        .map((c) => (
          '<div class="fb-comment">' +
          '<span class="fb-comment-stars">' + starsOf(c.rating) + '</span>' +
          '<span class="fb-comment-body">' +
          '<span class="fb-comment-head">' + fbPathTag(c) + '<span class="fb-comment-text">' + esc(c.comment) + '</span></span>' +
          '<span class="fb-comment-meta">' + fbPlace(c) + fbWhen(c) + '</span>' +
          '</span>' +
          '</div>'
        ))
        .join('');
      html += '</div>';
    }

    box.innerHTML = html;
  }

  function fbPathTag(c) {
    if (c.path === 'form') return '<span class="fb-tag fb-tag-fell">Caiu no phishing</span>';
    if (c.path === 'timeout') return '<span class="fb-tag fb-tag-safe">Não caiu</span>';
    return '';
  }

  function fbWhen(c) {
    if (!c.created_at) return '';
    const d = new Date(c.created_at);
    if (isNaN(d.getTime())) return '';
    const s = d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return '<span class="fb-comment-when">🕒 ' + esc(s) + '</span>';
  }

  function fbPlace(c) {
    const place = [c.city, c.region, c.country].filter(Boolean).join(', ');
    return place
      ? '<span class="fb-comment-place">📍 ' + esc(place) + '</span>'
      : '<span class="fb-comment-place is-empty">Localidade não registrada</span>';
  }

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
