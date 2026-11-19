(() => {
  const token = new URLSearchParams(location.search).get('token') || '';
  const url = '/api/metrics' + (token ? '?token=' + encodeURIComponent(token) : '');

  const spDay = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  fetch(url)
    .then((r) => {
      if (r.status === 401) throw new Error('unauthorized');
      return r.json();
    })
    .then(render)
    .catch((err) => {
      document.getElementById('note').textContent =
        err.message === 'unauthorized'
          ? 'Painel protegido. Adicione ?token=SEU_TOKEN na URL.'
          : 'Não foi possível carregar as métricas. O banco de dados já foi configurado nas variáveis de ambiente?';
    });

  function render(data) {
    const byday = data.byday || {};
    const total = data.total || 0;
    const today = Number(byday[spDay()] || 0);
    const entries = Object.entries(byday).sort((a, b) => (a[0] < b[0] ? -1 : 1));

    document.getElementById('total').textContent = total;
    document.getElementById('today').textContent = today;
    document.getElementById('days').textContent = entries.length;

    const max = Math.max(1, ...entries.map((e) => Number(e[1])));
    const chart = document.getElementById('chart');
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

    const tb = document.getElementById('events');
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
