(() => {
  const el = (id) => document.getElementById(id);

  // Dispara um estágio do funil (official). Agregado, sem dado do usuário.
  const track = (stage) =>
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }).catch(() => {});

  // Conta o acesso (abertura da página). Não envia nenhum dado do usuário.
  fetch('/api/hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});

  // Clique no link oficial do hackathon, dentro da revelação.
  const official = el('officialLink');
  if (official) official.addEventListener('click', () => track('official'));

  // "Último dia" sempre com a data de hoje — clássico golpe de urgência.
  (function deadline() {
    const t = el('today');
    if (!t) return;
    t.textContent = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date());
  })();

  // Cronômetro falso de "urgência" — puro teatro de phishing.
  (function countdown() {
    const cd = el('countdown');
    if (!cd) return;
    let secs = 5 * 60;
    const tick = () => {
      secs = Math.max(0, secs - 1);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      cd.textContent = m + ':' + s;
      if (secs === 0) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
  })();

  el('accessForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // Conta APENAS o clique em confirmar. Não lê nem envia o que foi digitado.
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});

    el('form').classList.add('hidden');
    el('scan').classList.remove('hidden');
    runScan();
  });

  function runScan() {
    const lines = [
      '> evidências recebidas',
      '> cruzando com a base de acesso...',
      '> validando credenciais...',
      '> resultado: FALHA',
    ];
    const term = el('terminal');
    const barFill = el('barFill');
    let i = 0;

    (function typeLine() {
      if (i < lines.length) {
        const d = document.createElement('div');
        d.className = 'tline';
        d.textContent = lines[i];
        term.appendChild(d);
        i++;
        barFill.style.width = Math.round((i / lines.length) * 100) + '%';
        setTimeout(typeLine, 650);
      } else {
        setTimeout(() => {
          el('scan').classList.add('hidden');
          el('reveal').classList.remove('hidden');
        }, 750);
      }
    })();
  }
})();
