# siscritico.agenteinvader.com.br — Demonstração de conscientização de segurança

Página simples que demonstra, de forma segura, **o risco de divulgar links que apontam para domínios não registrados**.

Quando alguém abre a página, ela mostra por alguns segundos uma tela sombria de "sistema restrito" e, em seguida, **revela a lição**: aquele domínio estava livre e qualquer pessoa — inclusive um golpista — poderia ter registrado e colocado no ar uma página falsa para roubar dados.

A página mostra um **formulário de "validação"** (crachá, placa, sala etc.) só como encenação: o participante acha que vai destravar algo e, ao confirmar, recebe o aviso de que foi uma simulação.

> ⚠️ **O que esta página NÃO faz:** ela **não lê, não envia e não guarda nada do que é digitado** no formulário. O que é registrado: dois contadores (quantas pessoas **abriram** a página e quantas **clicaram em confirmar**) e a **localização agregada** do acesso (país/região/cidade, dos cabeçalhos de geo do Vercel). **Nenhum IP** e nada que identifique a pessoa — é analytics agregado, fora do escopo de dado pessoal.

---

## Estrutura (monorepo com npm workspaces)

```
.
├── apps/
│   └── front-end/        # o site + as funções /api (deploy no Vercel)
│       ├── index.html / app.js / styles.css
│       ├── dashboard.html / dashboard.js / dashboard.css
│       ├── api/          # funções serverless (hit, metrics)
│       ├── lib/          # cliente Supabase
│       └── vercel.json
├── supabase/             # migrations do banco (aplicadas pelo CI)
├── .github/workflows/    # CI que roda as migrations
└── package.json          # raiz do workspace
```

Novos apps (ex.: `apps/api`, `apps/admin`) entram em `apps/*` e o workspace os reconhece automaticamente.

## O que tem aqui

Os caminhos abaixo são relativos a `apps/front-end/`.

| Rota | Arquivo | O que é |
|------|---------|---------|
| `/` | `index.html` + `app.js` | Página de demonstração (isca + revelação) |
| `/dashboard` | `dashboard.html` + `dashboard.js` | Painel de métricas de acessos |
| `/api/hit` | `api/hit.js` | Conta um acesso (abertura da página) |
| `/api/submit` | `api/submit.js` | Conta um clique em "Confirmar" — no máximo 1 por IP, sem ler o formulário e sem guardar o IP |
| `/api/event` | `api/event.js` | Conta o clique no link oficial na revelação (`official`) |
| `/api/feedback` | `api/feedback.js` | Salva a avaliação da revelação (nota 1-5 + comentário opcional) |
| `/api/metrics` | `api/metrics.js` | Devolve contadores, funil e avaliações (exige login do Supabase) |
| `/api/config` | `api/config.js` | Credenciais públicas do Supabase para o login no cliente |

- **Front-end:** HTML/CSS/JS puro, sem framework e sem build.
- **Back-end:** funções serverless do Vercel (`/api`).
- **Banco de dados:** [Supabase](https://supabase.com) (Postgres). Migrations em `supabase/migrations/`, aplicadas automaticamente pelo CI.

---

## Passo a passo do deploy no Vercel

### 1. Prepare o banco no Supabase

1. No [dashboard do Supabase](https://supabase.com/dashboard), abra (ou crie) o seu projeto.
2. **Você NÃO precisa rodar SQL na mão** — o CI aplica a migration automaticamente (veja a seção [CI/CD](#cicd-migrations-automáticas) abaixo). A migration cria a tabela `hits` e a view `hits_by_day`.
3. Pegue as credenciais de runtime em **Settings → API Keys** (nos projetos mais antigos, **Settings → API**):
   - **Project URL** → `SUPABASE_URL` (ex.: `https://abcdefgh.supabase.co`)
   - **service_role** (ou crie uma **secret key** `sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon** (ou **publishable** `sb_publishable_...`) → `SUPABASE_ANON_KEY` (pública, usada no login do painel)

> 🔒 A chave secreta/service_role ignora o RLS e dá acesso total ao banco. Use **só no servidor**, nunca no navegador, e **nunca** faça commit dela (o GitHub e o Supabase varrem repositórios atrás de chaves vazadas).

### 2. Importe o projeto no Vercel

1. Em **https://vercel.com** → **Add New… → Project**.
2. **Import Git Repository** e selecione `railsonribeiro/hackiathon-agenteinvader-prank`.
3. **Root Directory:** clique em **Edit** e selecione **`apps/front-end`** (é aqui que estão `index.html`, `api/` e `vercel.json`).
4. Framework Preset: **Other**. O Vercel detecta o monorepo npm workspaces e instala as dependências a partir da raiz.

### 3. Configure as variáveis de ambiente

No projeto do Vercel → **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role / secret (servidor) |
| `SUPABASE_ANON_KEY` | chave anon / publishable (pública, para o login) |

Depois de adicionar/alterar variáveis, faça um **Redeploy** para elas valerem.

### 4. Aponte o subdomínio

1. Registre o domínio **`agenteinvader.com.br`** no [Registro.br](https://registro.br) (se ainda não registrou).
2. No projeto do Vercel → **Settings → Domains** → adicione `siscritico.agenteinvader.com.br`.
3. O Vercel vai pedir para criar um registro **CNAME** no DNS:
   - **Nome/host:** `siscritico`
   - **Valor:** o que o Vercel mostrar (normalmente `cname.vercel-dns.com`)
4. Crie esse CNAME no painel de DNS do domínio (Registro.br, Cloudflare ou onde estiver). Em alguns minutos o endereço fica no ar.

Pronto: `https://siscritico.agenteinvader.com.br` mostra a demonstração e `…/dashboard` mostra as métricas.

---

## CI/CD: migrations automáticas

O workflow [`.github/workflows/supabase-migrations.yml`](.github/workflows/supabase-migrations.yml) aplica as migrations de `supabase/migrations/` no seu banco **a cada push na `main`** que altere migrations (e também pode ser disparado à mão em **Actions → Supabase Migrations → Run workflow**).

Para funcionar, cadastre 3 **secrets** no GitHub em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Onde pegar |
|--------|-----------|
| `SUPABASE_ACCESS_TOKEN` | Supabase → [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) → *Generate new token* |
| `SUPABASE_PROJECT_ID` | O *project ref* do projeto (o subdomínio da Project URL, ex.: `abcdefgh`) — também em **Settings → General** |
| `SUPABASE_DB_PASSWORD` | A senha do banco (**Settings → Database**; se não lembrar, gere uma nova ali) |

Depois de cadastrar os secrets, rode o workflow uma vez (push ou *Run workflow*) e a tabela é criada sozinha. Para adicionar mudanças no banco no futuro, crie um novo arquivo em `supabase/migrations/` (ex.: `20261201120000_add_coluna.sql`) e dê push — o CI aplica só o que estiver pendente.

> Esses secrets do CI são **diferentes** das variáveis de runtime do Vercel: aqui é token de acesso + senha do banco (para aplicar migrations); lá é a `SUPABASE_SERVICE_ROLE_KEY` (para as funções `/api` lerem e gravarem).

> Se preferir aplicar à mão em vez do CI, rode o conteúdo de `supabase/migrations/20261119000000_init.sql` no **SQL Editor** do Supabase.

---

## Painel de métricas

- Acesse em **`/dashboard`**.
- Mostra: **Acessos** e **Chegaram na revelação** (contadores), **Funil de conversão** (Abriram → Chegaram na revelação → Clicaram no link oficial → Avaliaram a simulação, com conversão por etapa), **Avaliações da simulação** (média, distribuição das notas e comentários) e **Localização dos acessos** — um card com alternância entre **País / Estado / Cidade** (padrão: Estado), agregado e sem IP.
- **"Chegaram na revelação"** = clique em *"Confirmar e desbloquear acesso"* (deduplicado por IP). Como o clique leva direto à revelação, é a mesma métrica — e reusa o contador que já tinha histórico.
- **Avaliações:** na revelação há um formulário de feedback (nota de 1 a 5 + comentário opcional) sobre a ideia da simulação. É anônimo (sem IP) e fica persistido na tabela `feedback`.
- **Privacidade:** todo o funil é contagem agregada por etapa, sem IP e sem cookie.
- **Login via Supabase (e-mail + senha):** o `/dashboard` mostra um formulário de login; a API `/api/metrics` valida o token do usuário no servidor e só então devolve os dados. Qualquer usuário cadastrado no seu projeto Supabase tem acesso.
- **Como gerenciar quem entra:** em **Supabase → Authentication → Users**, clique em **Add user** para criar cada admin (e-mail + senha). Para revogar o acesso de alguém, basta remover/desativar o usuário ali. O Supabase registra os logins (rastreabilidade por pessoa).
- Garanta que o provedor **Email** está habilitado em **Authentication → Providers** (vem ligado por padrão). Para esta demo, desligar a confirmação por e-mail facilita criar usuários direto no painel.
- Para restringir ainda mais (ex.: só e-mails de um domínio), dá para checar `userData.user.email` em `api/metrics.js`.

---

## Rodar localmente (opcional)

```bash
npm install                        # na raiz: instala o workspace inteiro
npm i -g vercel                    # se ainda não tiver a CLI
cp apps/front-end/.env.example apps/front-end/.env   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run dev                        # atalho para o app front-end (vercel dev)
```

---

## Fundo da tela (opcional)

A tela usa um fundo "cyber" feito só em CSS (sem depender de imagem). Se quiser usar uma imagem de fundo própria, salve-a em `assets/bg.jpg` e descomente o bloco indicado em `styles.css`.

---

## Nota ética

Este projeto foi feito para **conscientização de segurança** dentro de um hackathon: mostrar, sem enganar ninguém de verdade, por que não se deve publicar links apontando para domínios não registrados. Ele não imita nenhuma empresa real, não tem tela de login e não captura dados de usuários. Use apenas com esse propósito.
