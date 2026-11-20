(() => {
  const el = (id) => document.getElementById(id);

  // Por qual caminho a revelação apareceu: 'form' (preencheu e caiu) ou
  // 'timeout' (o cronômetro esgotou e ela não preencheu). A avaliação envia
  // isso para o painel separar quem caiu de quem não caiu.
  let revealPath = null;

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
        body: JSON.stringify({ rating, comment, path: revealPath }),
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

  // Trava única: a revelação só acontece uma vez, pelo formulário OU pelo tempo.
  let revealed = false;

  // Linhas do "scan" para cada caminho.
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

  // Cronômetro falso de "urgência" — puro teatro de phishing. Ao zerar, se a
  // pessoa NÃO preencheu o formulário, a revelação aparece mesmo assim: é a
  // chance de quem desconfiou descobrir que era uma simulação.
  (function countdown() {
    const cd = el('countdown');
    if (!cd) return;
    let secs = 6 * 60;
    const tick = () => {
      secs = Math.max(0, secs - 1);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      cd.textContent = m + ':' + s;
      if (secs === 0) {
        clearInterval(timer);
        if (!revealed) {
          // Não caiu: registra o estágio no funil e roda a animação própria.
          track('timeout');
          runScan(SCAN_TIMEOUT, 'timeout');
        }
      }
    };
    const timer = setInterval(tick, 1000);
  })();

  el('accessForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (revealed) return;

    // Conta o clique em confirmar. Em vez do conteúdo (que nunca é lido nem
    // enviado), manda só QUANTOS CARACTERES foram digitados em cada campo — dá
    // pra ver quem preencheu com os dados do PDF, sem guardar nada identificável.
    const len = (id) => ((el(id) && el(id).value) || '').trim().length;
    const lengths = {
      cracha: len('fCracha'),
      placa: len('fPlaca'),
      sala: len('fSala'),
      pedido: len('fPedido'),
    };

    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lengths }),
    }).catch(() => {});

    runScan(SCAN_FORM, 'form');
  });

  // Mostra a tela de "scan" e, ao fim da animação, revela pelo caminho dado.
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

  // Revela a simulação. O HTML já traz a versão "caiu" (form); para o caminho
  // 'timeout' (não caiu), troca título, textos e a pergunta da avaliação.
  function showReveal(path) {
    revealPath = path;

    if (path === 'timeout') {
      const setHtml = (id, html) => { const n = el(id); if (n) n.innerHTML = html; };
      const icon = el('revealIcon');
      if (icon) icon.textContent = '🛡️'; // 🛡️
      const title = el('revealTitle');
      if (title) { title.classList.remove('danger'); title.classList.add('safe'); title.textContent = 'VOCÊ NÃO CAIU.'; }
      setHtml('revealLead', 'Isto foi uma <strong>simulação de phishing</strong>.');
      setHtml('revealBody',
        'O cronômetro zerou e você <strong>não entregou nenhum dado</strong>. Esta página ' +
        'está num domínio que estava <strong>livre para qualquer pessoa registrar</strong> ' +
        '&mdash; inclusive um golpista. Quem preenchesse o formulário teria entregado tudo a ' +
        'um site desconhecido. Você não caiu &mdash; mas vale ver como o golpe tenta enganar.');
      setHtml('revealCallout',
        '<p><strong>Você não enviou nada.</strong></p>' +
        '<p class="muted">E, mesmo quando alguém envia, o conteúdo digitado não é lido nem ' +
        'guardado &mdash; só a quantidade de caracteres de cada campo, para a estatística. ' +
        'Esta página existe só para mostrar como um golpe de phishing engana as pessoas.</p>');
      // Pergunta direcionada a quem desconfiou (reusa o campo de comentário).
      const ft = el('feedbackTitle');
      if (ft) ft.textContent = 'Você desconfiou? Conte pra gente';
      const fc = el('feedbackComment');
      if (fc) fc.placeholder = 'O que te fez desconfiar? (opcional)';
    }

    const reveal = el('reveal');
    reveal.classList.remove('hidden');
    // Leva o foco para a revelação (leitores de tela anunciam o título).
    reveal.focus();
  }
})();
