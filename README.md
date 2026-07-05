# Meu Cofre

SaaS de controle financeiro pessoal (uso próprio), inspirado na profundidade do Conta Azul,
adaptado para finanças pessoais. **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase.**

> **Status:** Etapa 1 concluída — fundação (banco + RLS + autenticação + layout base).
> Os módulos funcionais entram nas próximas etapas (ver Roadmap).

## Stack

- **Front:** Next.js 14, TypeScript, Tailwind CSS, componentes próprios (estilo shadcn), Recharts, next-themes.
- **Backend:** Supabase (PostgreSQL 17) — banco, Auth (e-mail/senha), Storage, **RLS em todas as tabelas**.
- **Acesso a dados:** `@supabase/supabase-js` + `@supabase/ssr` (sessão em cookies).
- **Dinheiro:** sempre inteiro em **centavos** (`bigint`). Nunca float.

## Pré-requisitos

- Node.js 18+ (testado no 24)
- Uma conta/projeto Supabase (o projeto `financas-pessoais` já foi criado e migrado)

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Variáveis de ambiente
# O arquivo .env.local já vem preenchido com a URL e a chave pública (anon)
# do projeto financas-pessoais. Confira em .env.example o formato.

# 3. Rodar em desenvolvimento
npm run dev
# abre em http://localhost:3000
```

### Variáveis de ambiente (`.env.local`)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave publishable/anon (pode ir ao cliente; RLS protege) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só servidor** (scripts de seed/admin). Nunca exponha. Pegue no Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SITE_URL` | URL base do app (dev: `http://localhost:3000`) |

## Autenticação por e-mail

Por padrão, o Supabase exige **confirmação de e-mail** no cadastro. Para uso pessoal local,
você pode desativar em: **Supabase Dashboard → Authentication → Sign In / Providers → Email →
"Confirm email" (desligar)**. Assim o cadastro já entra direto, sem passo de e-mail.

O fluxo de **recuperação de senha** já está implementado (`/recuperar-senha` → e-mail →
`/redefinir-senha`).

## Banco de dados

O schema foi aplicado via migrations (pasta [`supabase/migrations`](supabase/migrations)):

- `0001` tipos enum · `0002` tabelas + índices · `0003` triggers + categorias padrão
- `0004` RLS + policies · `0005` Storage (`anexos`) · `0006` hardening de segurança

**20 tabelas**, todas com RLS (`user_id = auth.uid()`). Ao se cadastrar, um trigger cria o
`profile` e semeia as **categorias padrão** automaticamente.

Regenerar tipos TypeScript a partir do banco (opcional, requer Supabase CLI):

```bash
supabase gen types typescript --project-id jzgqkdfnkhsjiwkurekj > src/lib/database.types.ts
```

## Dados de exemplo (seed)

Como o cadastro já cria perfil + categorias, o jeito mais simples de ter dados é criar sua
conta e adicionar contas/lançamentos pela interface (a partir da Etapa 2). Um script de seed
com dados fictícios (que usa `SUPABASE_SERVICE_ROLE_KEY`) será adicionado junto ao módulo de
Lançamentos.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build |
| `npm run lint` | Lint |

## Estrutura

```
src/
  app/
    (auth)/        login, cadastro, recuperar-senha, redefinir-senha
    (app)/         dashboard + 14 módulos (layout com sidebar/topbar)
    auth/confirm/  callback dos links de e-mail
  components/      ui/ (button, input, card…), app-shell, theme, nav
  lib/
    supabase/      client (browser), server, middleware
    money.ts, format.ts, utils.ts, database.types.ts, zod-schemas/
supabase/migrations/   SQL versionado (já aplicado)
```

## Roadmap

1. ✅ **Fundação:** banco + RLS + Auth + layout base
2. Contas + Categorias/Tags
3. Lançamentos (receita/despesa/transferência) + filtros
4. Dashboard completo (gráficos)
5. Cartões e faturas
6. Contas a pagar/receber e recorrências
7. Orçamentos · 8. Metas · 9. Fluxo de caixa
10. Patrimônio e investimentos · 11. Relatórios + exportação
12. Importação (OFX/CSV) e conciliação · 13. Notificações e configurações
14. Polimento, PWA, tema escuro e testes finais

## Segurança

- RLS ativo em **todas** as tabelas; cada usuário só acessa os próprios dados.
- `service_role` nunca vai ao cliente.
- Bucket de Storage `anexos` privado, com policies por usuário (`{uid}/arquivo`).
- Advisor de segurança do Supabase sem alertas.
