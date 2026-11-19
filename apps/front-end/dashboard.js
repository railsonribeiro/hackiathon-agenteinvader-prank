(() => {
  const el = (id) => document.getElementById(id);
  const spDay = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  let sb = null;

  init();

  async function init() {
    // Pega as credenciais públicas do Supabase e inicia o cliente de auth.
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
    el('whoami').textContent = '';
    el('email').value = '';
    el('password').value = '';
    el('note').textContent = '';
    showLogin();
  }

  function showAuthed(session) {
    el('login').classList.add('hidden');
    el('content').classList.remove('hidden');
    el('whoami').textContent = (session.user && session.user.email) || '';
    loadMetrics(session.access_token);
  }

  function loadMetrics(token) {
    fetch('/api/metrics', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error('unauthorized');
        return r.json();
      })
      .then(render)
      .catch((err) => {
        el('note').textContent =
          err.message === 'unauthorized'
            ? 'Sua conta não tem acesso ao painel.'
            : 'Não foi possível carregar as métricas.';
      });
  }

  function render(data) {
    const byday = data.byday || {};
    const total = data.total || 0;
    const today = Number(byday[spDay()] || 0);
    const entries = Object.entries(byday).sort((a, b) => (a[0] < b[0] ? -1 : 1));

    el('total').textContent = total;
    el('today').textContent = today;
    el('days').textContent = entries.length;

    const max = Math.max(1, ...entries.map((e) => Number(e[1])));
    const chart = el('chart');
    chart.innerHTML = '';
    if (!entries.length) {
      chart.innerHTML = '<p class="muted">Nenhum acesso ainda.</p>';
    }
    entries.forEach(([day, count]) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML =
        '<span class="rday">' + day + '</span>' +
        '<span class="rbar"><span class="rfill" style="width:' +
        Math.round((Number(count) / max) * 100) + '%"></span></span>' +
        '<span class="rnum">' + count + '</span>';
      chart.appendChild(row);
    });

    const tb = el('events');
    tb.innerHTML = '';
    (data.events || []).forEach((ev) => {
      const tr = document.createElement('tr');
      let when = ev.t;
      try {
        when = new Date(ev.t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      } catch (e) {}
      const ref = ev.ref ? ev.ref : '—';
      tr.innerHTML = '<td>' + escapeHtml(when) + '</td><td class="ref">' + escapeHtml(ref) + '</td>';
      tb.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
