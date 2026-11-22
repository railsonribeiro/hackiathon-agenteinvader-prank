(() => {
  const el = (id) => document.getElementById(id);
  let sb = null;
  let accessToken = null;
  let locData = { country: [], state: [], city: [] };
  let locLevel = 'state';
  let lastData = null;
  let fbCommentPage = 0;
  let pdfDetailOpen = false;
  const FB_PAGE_SIZE = 8;

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

    wireReport();

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
        lastData = data;
        el('accesses').textContent = data.accesses || 0;
        el('submissions').textContent = data.submissions || 0;
        renderFunnel(data.funnel || []);
        renderFill(data.fill || null);
        fbCommentPage = 0;
        renderFeedback(data.feedback || null);
        const loc = data.locations || {};
        locData = {
          country: loc.country || [],
          state: loc.state || [],
          city: loc.city || [],
        };
        renderLocations();
        const reportBtn = el('reportBtn');
        if (reportBtn) reportBtn.disabled = false;
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

  // Linhas da distribuição de acertos (0..4 campos certos) — reusadas no painel
  // e no relatório em PDF.
  function fillDistRows(fill) {
    const dist = (fill && fill.distribution) || {};
    let html = '<div class="pdf-rows" role="list">';
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
    return html;
  }

  function bindFillToggle(box) {
    if (box.dataset.toggleBound) return;
    box.dataset.toggleBound = '1';
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.pdf-toggle');
      if (!btn) return;
      const panel = el('pdfDetail');
      if (!panel) return;
      pdfDetailOpen = !pdfDetailOpen;
      panel.hidden = !pdfDetailOpen;
      btn.classList.toggle('open', pdfDetailOpen);
      btn.setAttribute('aria-expanded', String(pdfDetailOpen));
    });
  }

  function renderFill(fill) {
    const box = el('fill');
    if (!box) return;
    bindFillToggle(box);
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

    html +=
      '<button type="button" class="pdf-toggle' + (pdfDetailOpen ? ' open' : '') + '"' +
      ' aria-expanded="' + pdfDetailOpen + '" aria-controls="pdfDetail">' +
      '<span class="pdf-toggle-lbl">Ver acertos por faixa</span>' +
      '<span class="pdf-toggle-chev" aria-hidden="true">&#9662;</span>' +
      '</button>' +
      '<div class="pdf-detail" id="pdfDetail"' + (pdfDetailOpen ? '' : ' hidden') + '>' +
      '<p class="pdf-detail-note">Quantos envios acertaram cada quantidade de campos (0 a 4).</p>' +
      fillDistRows(fill) +
      '</div>';

    box.innerHTML = html;
  }

  function bindFeedbackPager(box) {
    if (box.dataset.pagerBound) return;
    box.dataset.pagerBound = '1';
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.fb-page-btn');
      if (!btn || btn.disabled) return;
      const comments = (lastData && lastData.feedback && lastData.feedback.comments) || [];
      const pages = Math.max(1, Math.ceil(comments.length / FB_PAGE_SIZE));
      const dir = btn.dataset.dir === 'next' ? 1 : -1;
      fbCommentPage = Math.min(pages - 1, Math.max(0, fbCommentPage + dir));
      renderFeedback(lastData && lastData.feedback);
    });
  }

  function renderFeedback(fb) {
    const box = el('feedback');
    if (!box) return;
    bindFeedbackPager(box);
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
      const pages = Math.max(1, Math.ceil(comments.length / FB_PAGE_SIZE));
      if (fbCommentPage > pages - 1) fbCommentPage = pages - 1;
      if (fbCommentPage < 0) fbCommentPage = 0;
      const start = fbCommentPage * FB_PAGE_SIZE;
      const pageItems = comments.slice(start, start + FB_PAGE_SIZE);

      html += '<div class="fb-comments"><p class="fb-comments-title">Comentários <span class="fb-comments-count">(' + comments.length + ')</span></p>';
      html += pageItems
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

      if (pages > 1) {
        const from = start + 1;
        const to = Math.min(start + FB_PAGE_SIZE, comments.length);
        html +=
          '<div class="fb-pager">' +
          '<button type="button" class="fb-page-btn" data-dir="prev"' + (fbCommentPage === 0 ? ' disabled' : '') + ' aria-label="Página anterior">&#8249; Anteriores</button>' +
          '<span class="fb-page-info">' + from + '&ndash;' + to + ' de ' + comments.length + '</span>' +
          '<button type="button" class="fb-page-btn" data-dir="next"' + (fbCommentPage >= pages - 1 ? ' disabled' : '') + ' aria-label="Próxima página">Próximos &#8250;</button>' +
          '</div>';
      }
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

  // ---------------------------------------------------------------------------
  // Relatório em PDF: monta uma página de impressão limpa com TODOS os dados do
  // painel e dispara o diálogo de impressão (Salvar como PDF). Nada sai do
  // navegador — é só uma reformatação do que já está carregado.
  // ---------------------------------------------------------------------------
  function reportWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function reportOrigin() {
    const h = (location.hostname || '').replace(/^admin\./, 'siscritico.');
    return h || 'siscritico.agenteinvader.com.br';
  }

  function buildReportHTML(data, opts) {
    const d = data || {};
    const o = Object.assign({
      resumo: true, jornada: true, acertos: true, acertosDist: true,
      avaliacoes: true, comentarios: true, localizacao: true,
      locLevels: ['country', 'state', 'city'],
    }, opts || {});
    const accesses = Number(d.accesses || 0);
    const submissions = Number(d.submissions || 0);
    const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const fellPct = pctOf(submissions, accesses);

    const sections = [];

    // Resumo
    if (o.resumo) {
      sections.push(
        '<section><h2>Resumo</h2><table class="rt"><tbody>' +
        row2('Acessos à página', accesses, '') +
        row2('Caíram no phishing', submissions, fellPct + '% dos acessos') +
        '</tbody></table></section>'
      );
    }

    // Jornada (funil)
    if (o.jornada) {
      const by = {};
      (d.funnel || []).forEach((s) => { by[s.key] = Number(s.count) || 0; });
      const opened = by.open || 0;
      const revealed = FN_PATHS.reduce((t, k) => t + (by[k] || 0), 0);
      const fell = FN_FELL.reduce((t, k) => t + (by[k] || 0), 0);
      const timeout = by.timeout || 0;
      const rated = by.feedback || 0;
      let journeyRows =
        row2('Acessos à página', opened, '') +
        row2('Chegaram à revelação', revealed, pctOf(revealed, opened) + '% dos acessos') +
        row2('&nbsp;&nbsp;↳ Caíram no phishing (clicaram em Confirmar)', fell, pctOf(fell, revealed) + '% da revelação');
      FN_FELL.filter((k) => by[k] != null).forEach((k) => {
        journeyRows += row2('&nbsp;&nbsp;&nbsp;&nbsp;' + esc(FN_PATH_LABELS[k] || k), by[k] || 0, pctOf(by[k] || 0, fell) + '% de quem caiu');
      });
      journeyRows += row2('&nbsp;&nbsp;↳ Não caíram (esperaram o cronômetro)', timeout, pctOf(timeout, revealed) + '% da revelação');
      journeyRows += row2('Avaliaram a simulação', rated, pctOf(rated, revealed) + '% da revelação');
      sections.push(
        '<section><h2>Jornada na simulação</h2><table class="rt"><thead><tr><th>Etapa</th><th class="n">Nº</th><th class="n">%</th></tr></thead><tbody>' +
        journeyRows + '</tbody></table></section>'
      );
    }

    // Acertos com o PDF
    if (o.acertos) {
      const fill = d.fill || {};
      const answered = Number(fill.answered || 0);
      const allOk = Number(fill.allOk || 0);
      const avg = (Number(fill.avg || 0)).toFixed(1).replace('.', ',');
      const dist = fill.distribution || {};
      const fillSummary = answered
        ? '<p>' + allOk + ' de ' + answered + ' envios medidos acertaram os 4 campos (' + pctOf(allOk, answered) + '%). Média de ' + avg + ' de 4 campos certos por envio.</p>'
        : '<p class="muted">Nenhum envio com medição.</p>';
      let distTable = '';
      if (o.acertosDist && answered) {
        let fillRows = '';
        for (let n = 4; n >= 0; n--) {
          const c = Number(dist[n] || 0);
          fillRows += row2((n === 1 ? '1 campo certo' : n + ' campos certos') + (n === 0 ? ' (errou todos ou em branco)' : ''), c, pctOf(c, answered) + '%');
        }
        distTable = '<table class="rt"><thead><tr><th>Faixa</th><th class="n">Envios</th><th class="n">%</th></tr></thead><tbody>' + fillRows + '</tbody></table>';
      }
      sections.push('<section><h2>Acertos com os dados do PDF</h2>' + fillSummary + distTable + '</section>');
    }

    // Avaliações
    if (o.avaliacoes) {
      const fb = d.feedback || {};
      const fbCount = Number(fb.count || 0);
      const fbAvg = (Number(fb.avg || 0)).toFixed(1);
      const fbDist = fb.distribution || {};
      let fbDistRows = '';
      for (let n = 5; n >= 1; n--) fbDistRows += row2(n + ' estrela' + (n === 1 ? '' : 's'), Number(fbDist[n] || 0), pctOf(Number(fbDist[n] || 0), fbCount) + '%');
      const bp = fb.byPath || {};
      const fbPathRows =
        row2('De quem caiu no phishing', Number(bp.form || 0), '') +
        row2('De quem não caiu', Number(bp.timeout || 0), '') +
        (Number(bp.unknown || 0) ? row2('Caminho não identificado', Number(bp.unknown || 0), '') : '');
      let commentsBlock = '';
      if (o.comentarios) {
        const comments = fb.comments || [];
        if (comments.length) {
          const commentRows = comments.map((c) => {
            const stars = '★'.repeat(c.rating) + '☆'.repeat(Math.max(0, 5 - c.rating));
            const tag = c.path === 'form' ? 'Caiu' : (c.path === 'timeout' ? 'Não caiu' : '—');
            const place = [c.city, c.region, c.country].filter(Boolean).join(', ') || 'Localidade não registrada';
            return '<tr><td class="c-stars">' + stars + '</td><td class="c-tag">' + esc(tag) + '</td>' +
              '<td class="c-text">' + esc(c.comment) + '</td>' +
              '<td class="c-meta">' + esc(place) + '<br>' + esc(reportWhen(c.created_at)) + '</td></tr>';
          }).join('');
          commentsBlock = '<h3>Comentários (' + comments.length + ')</h3><table class="rt ct"><thead><tr><th>Nota</th><th>Caminho</th><th>Comentário</th><th>Local / data</th></tr></thead><tbody>' + commentRows + '</tbody></table>';
        } else {
          commentsBlock = '<p class="muted">Sem comentários.</p>';
        }
      }
      sections.push(
        '<section><h2>Avaliações da simulação</h2>' +
        '<p>Nota média: <strong>' + fbAvg + '</strong> &bull; ' + fbCount + (fbCount === 1 ? ' avaliação' : ' avaliações') + '</p>' +
        '<table class="rt"><thead><tr><th>Distribuição</th><th class="n">Nº</th><th class="n">%</th></tr></thead><tbody>' + fbDistRows + '</tbody></table>' +
        '<table class="rt"><thead><tr><th>Origem</th><th class="n">Nº</th><th class="n"></th></tr></thead><tbody>' + fbPathRows + '</tbody></table>' +
        commentsBlock +
        '</section>'
      );
    }

    // Localização (níveis escolhidos)
    if (o.localizacao) {
      const loc = d.locations || {};
      const locTable = (rows, label) => {
        if (!rows || !rows.length) return '<p class="muted">Sem dados.</p>';
        const body = rows.map((l) => {
          const place = [l.city, l.region, l.country].filter(Boolean).join(', ') || l.country || '—';
          return '<tr><td>' + esc(place) + '</td><td class="n">' + Number(l.count || 0) + '</td></tr>';
        }).join('');
        return '<table class="rt"><thead><tr><th>' + label + '</th><th class="n">Acessos</th></tr></thead><tbody>' + body + '</tbody></table>';
      };
      const levelMeta = {
        country: ['Por país', 'País', loc.country],
        state: ['Por estado', 'Estado', loc.state],
        city: ['Por cidade', 'Cidade', loc.city],
      };
      let locBody = '';
      (o.locLevels || []).forEach((lvl) => {
        const m = levelMeta[lvl];
        if (m) locBody += '<h3>' + m[0] + '</h3>' + locTable(m[2], m[1]);
      });
      if (locBody) {
        sections.push('<section><h2>Localização dos acessos</h2>' + locBody + '</section>');
      }
    }

    if (!sections.length) {
      sections.push('<section><p class="muted">Nenhuma seção selecionada.</p></section>');
    }

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<title>Relatório — Simulação de conscientização</title>' +
      '<style>' + REPORT_CSS + '</style></head><body>' +
      '<header class="rp-head"><h1>Relatório — Simulação de conscientização (Phishing)</h1>' +
      '<p class="rp-sub">' + esc(reportOrigin()) + ' &bull; gerado em ' + esc(reportWhen(new Date().toISOString())) + '</p>' +
      '<p class="rp-note">Dados agregados. Nenhum dado pessoal, IP ou conteúdo digitado é coletado.</p></header>' +
      sections.join('') +
      '<footer class="rp-foot">Simulação de conscientização de segurança &bull; ' + esc(reportOrigin()) + '</footer>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>' +
      '</body></html>';
  }

  function row2(label, num, note) {
    return '<tr><td>' + label + '</td><td class="n">' + num + '</td>' +
      (arguments.length > 2 ? '<td class="n muted">' + esc(note || '') + '</td>' : '') + '</tr>';
  }

  const REPORT_CSS =
    'body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;background:#fff;margin:32px;}' +
    'h1{font-size:20px;margin:0 0 4px;}h2{font-size:16px;margin:26px 0 8px;border-bottom:2px solid #e2203b;padding-bottom:4px;}' +
    'h3{font-size:13px;margin:16px 0 6px;color:#444;}' +
    '.rp-sub{color:#555;margin:0 0 2px;}.rp-note{color:#777;font-size:12px;margin:0;}' +
    '.rp-head{border-bottom:1px solid #ddd;padding-bottom:12px;}' +
    'table.rt{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:13px;}' +
    '.rt th,.rt td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;}' +
    '.rt th{color:#555;font-weight:600;border-bottom:1px solid #ccc;}' +
    '.rt td.n,.rt th.n{text-align:right;white-space:nowrap;}' +
    '.muted{color:#888;}' +
    '.ct td.c-stars{color:#d49a00;white-space:nowrap;}.ct td.c-tag{white-space:nowrap;color:#555;}.ct td.c-meta{color:#777;font-size:11px;white-space:nowrap;}' +
    '.rp-foot{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;color:#999;font-size:11px;}' +
    '@media print{body{margin:0;}h2{break-after:avoid;}tr{break-inside:avoid;}}';

  function toggleReportPanel(open) {
    const panel = el('reportOptions');
    const btn = el('reportBtn');
    if (!panel) return;
    const show = open == null ? panel.hidden : open;
    panel.hidden = !show;
    if (btn) btn.setAttribute('aria-expanded', String(show));
  }

  // Dependências entre as opções: sub-itens só fazem sentido com o pai marcado.
  function syncReportDeps() {
    const panel = el('reportOptions');
    if (!panel) return;
    const opt = (k) => panel.querySelector('[data-opt="' + k + '"]');
    const setDep = (parentKey, childKey) => {
      const p = opt(parentKey);
      const c = opt(childKey);
      if (!p || !c) return;
      c.disabled = !p.checked;
      const lbl = c.closest('.ro-item');
      if (lbl) lbl.classList.toggle('ro-off', !p.checked);
    };
    setDep('acertos', 'acertosDist');
    setDep('avaliacoes', 'comentarios');
    const locOn = opt('localizacao');
    const locBox = panel.querySelector('.ro-loc');
    if (locOn && locBox) {
      locBox.classList.toggle('ro-off', !locOn.checked);
      locBox.querySelectorAll('[data-loc]').forEach((c) => { c.disabled = !locOn.checked; });
    }
  }

  function readReportOptions() {
    const panel = el('reportOptions');
    const get = (k) => {
      const c = panel && panel.querySelector('[data-opt="' + k + '"]');
      return c ? c.checked : true;
    };
    const locLevels = [];
    if (panel) {
      panel.querySelectorAll('[data-loc]').forEach((c) => { if (c.checked) locLevels.push(c.dataset.loc); });
    }
    return {
      resumo: get('resumo'),
      jornada: get('jornada'),
      acertos: get('acertos'),
      acertosDist: get('acertosDist'),
      avaliacoes: get('avaliacoes'),
      comentarios: get('comentarios'),
      localizacao: get('localizacao'),
      locLevels: locLevels.length ? locLevels : ['country', 'state', 'city'],
    };
  }

  function wireReport() {
    const btn = el('reportBtn');
    const panel = el('reportOptions');
    const gen = el('reportGen');
    const cancel = el('reportCancel');
    if (btn) btn.addEventListener('click', () => { toggleReportPanel(); syncReportDeps(); });
    if (cancel) cancel.addEventListener('click', () => toggleReportPanel(false));
    if (panel) panel.addEventListener('change', syncReportDeps);
    if (gen) gen.addEventListener('click', () => {
      generateReport(lastData, readReportOptions());
      toggleReportPanel(false);
    });
  }

  function generateReport(data, opts) {
    if (!data) return;
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para este site para gerar o relatório em PDF.');
      return;
    }
    w.document.open();
    w.document.write(buildReportHTML(data, opts));
    w.document.close();
    w.focus();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
