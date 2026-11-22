(() => {
  const el = (id) => document.getElementById(id);



  let revealPath = null;

  const track = (stage) =>
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }).catch(() => {});

  fetch('/api/hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});

  (function feedback() {
    const form = el('feedbackForm');
    if (!form) return;
    const starsBox = el('stars');
    const stars = starsBox ? Array.from(starsBox.querySelectorAll('.star')) : [];
    const submit = el('feedbackSubmit');
    const hint = el('feedbackHint');
    let rating = 0;

    const paint = () => {
      stars.forEach((s) => {
        const v = Number(s.dataset.value);
        s.classList.toggle('on', v <= rating);
        s.setAttribute('aria-checked', v === rating ? 'true' : 'false');

        s.tabIndex = v === (rating || 1) ? 0 : -1;
      });
    };

    const select = (value, focus) => {
      rating = Math.min(5, Math.max(1, value));
      paint();
      if (focus && stars[rating - 1]) stars[rating - 1].focus();
      if (submit) submit.disabled = false;
      if (hint) hint.textContent = '';
    };

    stars.forEach((s) => {
      s.addEventListener('click', () => select(Number(s.dataset.value), false));
    });

    if (starsBox) {
      starsBox.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); select(rating === 0 ? 1 : rating + 1, true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); select(rating === 0 ? 1 : rating - 1, true); }
        else if (e.key === 'Home') { e.preventDefault(); select(1, true); }
        else if (e.key === 'End') { e.preventDefault(); select(5, true); }
      });
    }

    paint();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (rating < 1) return;
      if (submit) submit.disabled = true;
      const comment = (el('feedbackComment') && el('feedbackComment').value) || '';

      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, path: revealPath }),
      }).catch(() => {});

      form.classList.add('hidden');
      const thanks = el('feedbackThanks');
      if (thanks) thanks.classList.remove('hidden');
    });
  })();

  (function deadline() {
    const t = el('today');
    if (!t) return;
    t.textContent = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date());
  })();

  let revealed = false;

  const SCAN_FORM = [
    '> evidências recebidas',
    '> cruzando com a base de acesso...',
    '> validando credenciais...',
    '> resultado: FALHA',
  ];
  const SCAN_TIMEOUT = [
    '> sessão de validação expirada',
    '> nenhum dado recebido',
    '> encerrando acesso...',
    '> análise: usuário não interagiu',
  ];



  (function countdown() {
    const cd = el('countdown');
    if (!cd) return;
    let secs = 5 * 60;
    const tick = () => {
      secs = Math.max(0, secs - 1);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      cd.textContent = m + ':' + s;
      if (secs === 0) {
        clearInterval(timer);
        if (!revealed) {

          track('timeout');
          runScan(SCAN_TIMEOUT, 'timeout');
        }
      }
    };
    const timer = setInterval(tick, 1000);
  })();


  (function placaMask() {
    const placa = el('fPlaca');
    if (!placa) return;
    placa.addEventListener('input', () => {
      let v = placa.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
      if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
      placa.value = v;
    });
  })();

  el('accessForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (revealed) return;





    const EXPECTED = { fCracha: '00994', fPlaca: 'RQK-7A26', fSala: '1407', fPedido: '4471' };
    const norm = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, '');
    let correct = 0;
    let filled = 0;
    Object.keys(EXPECTED).forEach((id) => {
      const v = el(id) ? norm(el(id).value) : '';
      if (v) filled += 1;
      if (v && v === norm(EXPECTED[id])) correct += 1;
    });

    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct, filled }),
    }).catch(() => {});

    runScan(SCAN_FORM, 'form');
  });

  function runScan(lines, path) {
    if (revealed) return;
    revealed = true;

    el('form').classList.add('hidden');
    const scan = el('scan');
    scan.classList.remove('hidden');

    const term = el('terminal');
    const barFill = el('barFill');
    if (term) term.textContent = '';
    if (barFill) barFill.style.width = '0%';
    let i = 0;

    (function typeLine() {
      if (i < lines.length) {
        const d = document.createElement('div');
        d.className = 'tline';
        d.textContent = lines[i];
        if (term) term.appendChild(d);
        i++;
        if (barFill) barFill.style.width = Math.round((i / lines.length) * 100) + '%';
        setTimeout(typeLine, 650);
      } else {
        setTimeout(() => {
          scan.classList.add('hidden');
          showReveal(path);
        }, 750);
      }
    })();
  }


  function showReveal(path) {
    revealPath = path;

    if (path === 'timeout') {
      const setHtml = (id, html) => { const n = el(id); if (n) n.innerHTML = html; };
      const icon = el('revealIcon');
      if (icon) icon.textContent = '🛡️';
      const title = el('revealTitle');
      if (title) { title.classList.remove('danger'); title.classList.add('safe'); title.textContent = 'VOCÊ NÃO CAIU.'; }
      setHtml('revealLead', 'Isto foi uma <strong>simulação de phishing</strong>.');
      setHtml('revealBody',
        'O cronômetro zerou e você <strong>não entregou nenhum dado</strong>. Esta página ' +
        'está num domínio que estava <strong>livre para qualquer pessoa registrar</strong> ' +
        '&mdash; inclusive um golpista. Quem preenchesse o formulário teria entregado tudo a ' +
        'um site desconhecido. Você não caiu &mdash; mas vale ver como o golpe tenta enganar.');
      setHtml('revealCallout', 'Você não enviou nada &mdash; e o que se digita aqui não sai do navegador.');

      const ft = el('feedbackTitle');
      if (ft) ft.textContent = 'Você desconfiou? Conte pra gente';
      const fc = el('feedbackComment');
      if (fc) fc.placeholder = 'O que te fez desconfiar? (opcional)';
    }

    const reveal = el('reveal');
    reveal.classList.remove('hidden');

    reveal.focus();
  }
})();
