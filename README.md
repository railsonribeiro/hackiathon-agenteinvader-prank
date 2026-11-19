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
| `/api/hit` | `api/hit.js` | Registra um acesso (insere uma linha) |
| `/api/metrics` | `api/metrics.js` | Devolve as métricas para o painel |

- **Front-end:** HTML/CSS/JS puro, sem framework e sem build.
- **Back-end:** funções serverless do Vercel (`/api`).
- **Banco de dados:** [Supabase](https://supabase.com) (Postgres). Schema em `supabase/schema.sql`.

---

## Passo a passo do deploy no Vercel

### 1. Prepare o banco no Supabase

1. No [dashboard do Supabase](https://supabase.com/dashboard), abra (ou crie) o seu projeto.
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria a tabela `hits` e a view `hits_by_day`.
3. Pegue as credenciais em **Settings → API Keys** (nos projetos mais antigos, **Settings → API**):
   - **Project URL** → `SUPABASE_URL` (ex.: `https://abcdefgh.supabase.co`)
   - **service_role** (ou crie uma **secret key** `sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`

> 🔒 A chave secreta/service_role ignora o RLS e dá acesso total ao banco. Use **só no servidor**, nunca no navegador, e **nunca** faça commit dela (o GitHub e o Supabase varrem repositórios atrás de chaves vazadas).

### 2. Importe o projeto no Vercel

1. Em **https://vercel.com** → **Add New… → Project**.
2. **Import Git Repository** e selecione `railsonribeiro/hackiathon-agenteinvader-prank`.
3. Framework Preset: **Other** (não precisa mudar nada).

### 3. Configure as variáveis de ambiente

No projeto do Vercel → **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role / secret |
| `DASHBOARD_TOKEN` | *(opcional)* uma senha para proteger o painel |

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

## Painel de métricas

- Acesse em **`/dashboard`**.
- Mostra: acessos totais, acessos de hoje, acessos por dia (gráfico) e os últimos acessos.
- Se você definir `DASHBOARD_TOKEN`, o painel fica protegido — acesse em **`/dashboard?token=SEU_TOKEN`**.

---

## Rodar localmente (opcional)

```bash
npm install
npm i -g vercel          # se ainda não tiver a CLI
cp .env.example .env     # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
vercel dev               # sobe em http://localhost:3000
```

---

## Fundo da tela (opcional)

A tela usa um fundo "cyber" feito só em CSS (sem depender de imagem). Se quiser usar uma imagem de fundo própria, salve-a em `assets/bg.jpg` e descomente o bloco indicado em `styles.css`.

---

## Nota ética

Este projeto foi feito para **conscientização de segurança** dentro de um hackathon: mostrar, sem enganar ninguém de verdade, por que não se deve publicar links apontando para domínios não registrados. Ele não imita nenhuma empresa real, não tem tela de login e não captura dados de usuários. Use apenas com esse propósito.
