(() => {
  // Registra o acesso (métrica de visita). Não envia nenhum dado do usuário.
  fetch('/api/hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});

  const lines = [
    '> conexão recebida',
    '> origem: domínio não verificado',
    '> validando certificado de confiança...',
    '> resultado: FALHA',
  ];

  const term = document.getElementById('terminal');
  const barFill = document.getElementById('barFill');
  let i = 0;

  function typeLine() {
    if (i < lines.length) {
      const el = document.createElement('div');
      el.className = 'tline';
      el.textContent = lines[i];
      term.appendChild(el);
      i++;
      barFill.style.width = Math.round((i / lines.length) * 100) + '%';
      setTimeout(typeLine, 650);
    } else {
      setTimeout(showReveal, 750);
    }
  }

  function showReveal() {
    document.getElementById('scan').classList.add('hidden');
    document.getElementById('reveal').classList.remove('hidden');
  }

  typeLine();
})();
