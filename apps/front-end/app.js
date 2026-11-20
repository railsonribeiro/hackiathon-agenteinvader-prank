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

  // Feedback da revelação: estrelas 1-5 (radiogroup acessível) + comentário.
  (function feedback() {
    const form = el('feedbackForm');
    if (!form) return;
    const starsBox = el('stars');
    const stars = starsBox ? Array.from(starsBox.querySelectorAll('.star')) : [];
    const submit = el('feedbackSubmit');
    const hint = el('feedbackHint');
    let rating = 0;

    // Reflete a nota no visual e no ARIA (aria-checked + foco rotativo).
    const paint = () => {
      stars.forEach((s) => {
        const v = Number(s.dataset.value);
        s.classList.toggle('on', v <= rating);
        s.setAttribute('aria-checked', v === rating ? 'true' : 'false');
        // Roving tabindex: tabulável a selecionada; antes de escolher, a 1ª.
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

    // Teclado: setas navegam/escolhem, Home/End vão aos extremos.
    if (starsBox) {
      starsBox.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); select(rating === 0 ? 1 : rating + 1, true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); select(rating === 0 ? 1 : rating - 1, true); }
        else if (e.key === 'Home') { e.preventDefault(); select(1, true); }
        else if (e.key === 'End') { e.preventDefault(); select(5, true); }
      });
    }

    paint(); // estado inicial (1ª estrela tabulável)

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (rating < 1) return;
      if (submit) submit.disabled = true;
      const comment = (el('feedbackComment') && el('feedbackComment').value) || '';

      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      }).catch(() => {});

      // Mostra o agradecimento independente da resposta (não trava o usuário).
      form.classList.add('hidden');
      const thanks = el('feedbackThanks');
      if (thanks) thanks.classList.remove('hidden');
    });
  })();

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
          const reveal = el('reveal');
          reveal.classList.remove('hidden');
          // Leva o foco para a revelação (leitores de tela anunciam o "PARE").
          reveal.focus();
        }, 750);
      }
    })();
  }
})();
