# siscritico.agenteinvader.com.br — Demonstração de conscientização de segurança

Página simples que demonstra, de forma segura, **o risco de divulgar links que apontam para domínios não registrados**.

Quando alguém abre a página, ela mostra por alguns segundos uma tela sombria de "sistema restrito" e, em seguida, **revela a lição**: aquele domínio estava livre e qualquer pessoa — inclusive um golpista — poderia ter registrado e colocado no ar uma página falsa para roubar dados.

> ⚠️ **O que esta página NÃO faz:** ela não tem formulário, não pede usuário/senha e **não coleta nenhum dado pessoal** de quem acessa. A única informação guardada é a contagem de acessos (e metadados básicos de requisição, como um log de servidor), usada no painel de métricas para mostrar à equipe quantas pessoas chegaram até ali por um link desses.

---

## O que tem aqui

| Rota | Arquivo | O que é |
|------|---------|---------|
| `/` | `index.html` + `app.js` | Página de demonstração (isca + revelação) |
| `/dashboard` | `dashboard.html` + `dashboard.js` | Painel de métricas de acessos |
| `/api/hit` | `api/hit.js` | Registra um acesso (contador) |
| `/api/metrics` | `api/metrics.js` | Devolve as métricas para o painel |

- **Front-end:** HTML/CSS/JS puro, sem framework e sem build.
- **Back-end:** funções serverless do Vercel (`/api`).
- **Banco de dados:** [Upstash Redis](https://upstash.com) (serverless, free tier) para guardar o contador.

---

## Passo a passo do deploy no Vercel

### 1. Crie o banco de dados (Upstash Redis)

1. Crie uma conta gratuita em **https://upstash.com**.
2. **Create Database** → escolha um nome e a região mais próxima (ex.: `sa-east-1`, São Paulo).
3. Na página do banco, abra a aba **REST API** e copie:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> Alternativa: você também pode adicionar o Upstash pelo **Marketplace do Vercel** (passo 4). Nesse caso o Vercel cria as variáveis automaticamente — o código aceita tanto `UPSTASH_REDIS_REST_*` quanto `KV_REST_API_*`.

### 2. Importe o projeto no Vercel

1. Em **https://vercel.com** → **Add New… → Project**.
2. **Import Git Repository** e selecione `railsonribeiro/hackiathon-agenteinvader-prank`.
3. Framework Preset: **Other** (não precisa mudar nada). Clique em **Deploy** — ou configure as variáveis antes (passo 3) e depois faça o deploy.

### 3. Configure as variáveis de ambiente

No projeto do Vercel → **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `UPSTASH_REDIS_REST_URL` | (copiado do Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | (copiado do Upstash) |
| `DASHBOARD_TOKEN` | *(opcional)* uma senha para proteger o painel |

Depois de adicionar/alterar variáveis, faça um **Redeploy** para elas valerem.

### 4. Aponte o subdomínio

1. Registre o domínio **`agenteinvader.com.br`** no [Registro.br](https://registro.br) (se ainda não registrou).
2. No projeto do Vercel → **Settings → Domains** → adicione `siscritico.agenteinvader.com.br`.
3. O Vercel vai pedir para criar um registro **CNAME** no DNS:
   - **Nome/host:** `siscritico`
   - **Valor:** `cname.vercel-dns.com` (o Vercel mostra o valor exato)
4. Crie esse CNAME no painel de DNS do domínio (Registro.br, Cloudflare ou onde estiver). Em alguns minutos o endereço fica no ar.

Pronto: `https://siscritico.agenteinvader.com.br` mostra a demonstração e `…/dashboard` mostra as métricas.

---

## Painel de métricas

- Acesse em **`/dashboard`**.
- Mostra: acessos totais, acessos de hoje, acessos por dia (gráfico) e os últimos acessos.
- Se você definir `DASHBOARD_TOKEN`, o painel fica protegido — acesse em **`/dashboard?token=SEU_TOKEN`**.

---

## Rodar localmente (opcional)

Precisa das variáveis do Upstash para o contador funcionar.

```bash
npm install
npm i -g vercel          # se ainda não tiver a CLI
cp .env.example .env     # preencha UPSTASH_REDIS_REST_URL e _TOKEN
vercel dev               # sobe em http://localhost:3000
```

---

## Fundo da tela (opcional)

A tela usa um fundo "cyber" feito só em CSS (sem depender de imagem). Se quiser usar uma imagem de fundo própria, salve-a em `assets/bg.jpg` e descomente o bloco indicado em `styles.css`.

---

## Nota ética

Este projeto foi feito para **conscientização de segurança** dentro de um hackathon: mostrar, sem enganar ninguém de verdade, por que não se deve publicar links apontando para domínios não registrados. Ele não imita nenhuma empresa real, não tem tela de login e não captura dados de usuários. Use apenas com esse propósito.
