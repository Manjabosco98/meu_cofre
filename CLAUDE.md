# CLAUDE.md — Meu Cofre

> **Rotina obrigatória de handoff:** no início de cada sessão, leia este arquivo e
> `docs/HISTORICO.md` antes de qualquer ação e diga em uma frase onde paramos. Ao
> final da sessão (ou após mudança significativa), atualize os dois. Entradas
> concisas, datadas, objetivas.

## Visão geral
SaaS de **controle financeiro pessoal**, uso próprio (single-user), pt-BR, moeda BRL.
Inspirado na profundidade do Conta Azul, adaptado para finanças pessoais. Não é para venda.

## Stack e infraestrutura
- **Front:** Next.js 14 (App Router) + TypeScript + Tailwind + componentes próprios estilo shadcn + Recharts + next-themes. Ícones lucide-react.
- **Backend:** **Supabase** (Postgres 17). Projeto `financas-pessoais` — ref `jzgqkdfnkhsjiwkurekj`, região sa-east-1, org `Manjabosco` (`ovrzfpufbbfktbekmesd`). Existe outro projeto `sgecont-prod` que **NÃO deve ser tocado**.
- **Auth:** Supabase Auth (e-mail/senha) via `@supabase/ssr` (sessão em cookies). **RLS em TODAS as tabelas** (`user_id = auth.uid()`). Storage: bucket privado `anexos` (policies por `{uid}/arquivo`).
- **Migrations:** aplicadas via MCP do Supabase e versionadas em `supabase/migrations/` (0001–0020).
- **Usuário admin** (single-user): `manjabosco98@gmail.com` criado direto no banco (confirmado). Cadastro público desativado (`/cadastro` redireciona p/ `/login`).
- **.env.local:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) preenchidos. `SUPABASE_SERVICE_ROLE_KEY` vazio (usuário adiciona só se precisar de seed/admin).

## Convenções de código
- **Dinheiro = SEMPRE inteiro em centavos** (`bigint` no banco, `number` no TS). Nunca float. Componente `MoneyInput` (dígitos→centavos). Formatação `formatBRL`/`formatDate` (pt-BR, `America/Sao_Paulo`, DD/MM/AAAA) em `src/lib/format.ts`.
- **Datas:** guardar o dia como `YYYY-MMDDT12:00:00.000Z` (meio-dia UTC) para não deslocar no fuso BRT.
- **Estrutura por módulo:** `src/app/(app)/<modulo>/page.tsx` (Server Component, `export const dynamic = "force-dynamic"`, busca dados) + `actions.ts` (`"use server"`, mutations) + componentes em `src/components/<modulo>/` (Client Components de view/form).
- **Mutations:** Server Actions com validação **Zod** (schemas em `src/lib/zod-schemas/`). Retornam `ActionResult = {ok:true} | {ok:false,error:string}` (`src/lib/action-result.ts`). Client chama a action, mostra erro e faz `router.refresh()`.
- **Agregações** (saldos, totais): funções Postgres RPC `security invoker` (respeitam RLS) — ex.: `get_account_balances()`, `get_invoice_totals()`.
- **Supabase client:** `src/lib/supabase/{client,server,middleware}.ts`. **IMPORTANTE:** os wrappers anotam o retorno como `SupabaseClient<Database>` (+ cast) porque o tipo inferido do `@supabase/ssr` colapsa para `never` na fronteira da função (schema grande, 20 tabelas).
- **Tipos do banco:** `src/lib/database.types.ts` (gerado; atualizar ao mudar schema — RPCs também).
- **Filtros/estado de tela:** via `searchParams` (URL), atualizados por Client Components.
- Componentes UI base em `src/components/ui/` (button, input, select, dialog, card, badge, label, textarea).
- **Performance/navegação (padrão a manter):** skeleton de navegação em `src/app/(app)/loading.tsx` (Suspense — troca de tela é imediata). **Gráficos Recharts sempre lazy** via `next/dynamic` `ssr:false` — os 3 do dashboard em `src/components/dashboard/lazy-charts.tsx`; nas telas client (cashflow/budgets) usar `dynamic()` inline. Nunca importar Recharts estaticamente numa página. **Auth:** `getUser()` **apenas no middleware** (`src/lib/supabase/middleware.ts`) — é o gate de segurança + refresh de token. Em todos os Server Components/Actions, usar `getSession()` (JWT local, sem rede) — o middleware já validou. `getUserIdFromSession()` em `src/lib/supabase/server.ts` é o helper compartilhado. **RLS:** policies usam `(select auth.uid())` (avalia uma vez). Rodar o **advisor de performance** do Supabase ao adicionar tabelas/FKs (índices de cobertura). **Nota:** o Supabase emite warning "Using the user object as returned from getSession() could be insecure" nos logs ao usar `getSession()` no servidor. Isso é **esperado e aceito** — o warning é uma proteção teórica contra cookies forjados, mas o middleware já valida o JWT via `getUser()` em toda request + RLS protege todos os dados. O ganho de ~300–600ms por navegação justifica manter `getSession()`.
- **React Query (@tanstack/react-query):** provider em `src/components/providers.tsx` (staleTime: 5min, gcTime: 30min). Infraestrutura em `src/lib/query-utils.tsx` (makeQueryClient + ServerHydration), `src/lib/query-fns.ts` (Server Actions de dados), `src/lib/query-keys.ts` (chaves + groups para invalidação seletiva), `src/lib/use-invalidate.ts` (hook que combina invalidação React Query + router.refresh). **Padrão por página:** Server Component faz `fetchQuery` + dehydrate; Client Component recebe dados via props (compatível) e o React Query cache fica no client. Após mutations, invalidar queries afetadas via `queryGroups.*` em vez de `router.refresh()` genérico.

## Modelo de dados (tabelas principais)
Todas com `user_id` (FK `auth.users`) + RLS. Dinheiro em centavos (`bigint`).
- **profiles** (1:1 auth.users; nome, moeda, fuso, tema) — criado por trigger `handle_new_user` que também roda `seed_default_categories`.
- **accounts** — carteiras. `type` (checking/savings/cash/credit_card/investment), `institution` = **slug do banco** (`src/lib/banks.ts`; ex.: `nubank`) ou texto livre p/ "Outro"; logo via `<BankLogo>` (SVGs em `/public/banks/`), `titularidade` (PF/PJ), `agencia`, `numero_conta`, `initial_balance_cents`, `color`, `icon`, `archived`. `name` = **apelido/rótulo**.
- **categories** — `kind` (income/expense), `parent_id` (subcategorias), cor/ícone, `is_default`.
- **tags** + **transaction_tags** (N:N).
- **transactions** — `type` (income/expense/transfer), `amount_cents` (invariante: cleared→realizado, pending→previsto), `valor_previsto`, `valor_realizado`, `data_realizacao`, `date`, `status` (pending/cleared), `account_id`, `category_id`, `transfer_group_id`, `invoice_id`, `recurring_rule_id`, `recurring_subscription_id`, `installment_*`, `import_batch_id`, `fingerprint`.
- **credit_cards** (1:1 conta credit_card; limite, closing_day, due_day, brand) + **invoices** (período, due_date, status, paid_transaction_id).
- **recurring_rules** (template de recorrência; frequency, interval, start/end_date, occurrences, next_run_date, active).
- **recurring_subscriptions** (assinaturas recorrentes em cartões; credit_card_id, description, amount, frequency, interval, start/end_date, status, next_billing_date, active).
- **budgets** (category_id, month=1º dia, limit_cents; unique user+cat+mês).
- **goals** + **goal_contributions** (aportes/resgates com sinal).
- **investments** + **investment_entries**; **net_worth_snapshots**; **attachments**; **import_batches**; **notifications**; **ofx_acctid_map** (ACCTID UUID → cartão, para auto-seleção no reimport).
- **Cofre de acessos** (migration 0017; tela `/configuracoes/cofre`, aba em Configurações): **vault_settings** (salt/iterations/**verifier** cifrado — nunca guarda a senha-mestra), **vault_items** (campos `encrypted_*` = **só base64, cifrado no cliente**; planos: name/type/url/username/category/status/has_2fa/recovery_*/expires_at/favorite/`tags text[]`), **vault_audit_logs** (histórico sem valores de segredo). Enums `vault_item_type`/`vault_item_status`/`vault_audit_action`. RLS `(select auth.uid())` nas 3. **Cripto client-side** (`src/lib/vault-crypto.ts`, Web Crypto, sem deps): PBKDF2-SHA256 310k → AES-GCM 256, chave só em memória, **senha-mestra separada do login**, auto-lock 5min. O servidor **nunca** vê texto puro nem a senha-mestra.

## Regras e decisões fixas
1. **Saldo da conta** = `initial_balance_cents` + Σ efeitos dos lançamentos **cleared** (usando `amount_cents` = valor realizado). Sinais: income `+amount`, expense `-amount`, transfer = **par de pernas** (origem `-valor`, destino `+valor`, mesmo `transfer_group_id`). RPC `get_account_balances`.
2. **Previsto x Realizado**: `amount_cents` é mantido por trigger `sync_transaction_amounts` — cleared usa `valor_realizado`, pending usa `valor_previsto`. Previstos (`status=pending`) não contam no saldo; "quitar" = mudar para `cleared`. Ao marcar como realizado, o usuário pode informar um valor diferente (ex.: recebeu R$ 5.980 em vez de R$ 6.000); a diferença é exibida na lista e no form.
3. **Cartão de crédito**: conta do tipo `credit_card`, gerida **só na aba Cartões** (excluída da lista de Contas e do seletor de Lançamentos), mas **entra no saldo consolidado/patrimônio como passivo**. Compra = despesa na conta do cartão, atribuída à fatura por `closing_day` (`src/lib/card-invoice.ts`). Parcelamento = N lançamentos, 1 por fatura. Pagar fatura = transferência conta→cartão + `invoices.status=paid`. `credit_cards.linked_account_id` (FK, `ON DELETE SET NULL`) = **conta de pagamento padrão** (pré-selecionada ao pagar, editável). `credit_cards.last4` = só os **4 últimos dígitos** (nunca o número completo; check `^[0-9]{4}$`), exibido "•••• 1234". `brand` = bandeira (Visa/Master); o **banco/instituição** fica em `accounts.institution` — **herdado da conta vinculada** quando houver (denormalizado no save; campo manual só aparece sem conta). O **apelido** é `accounts.name` (rótulo do card), editável e, quando vazio, **derivado** de banco + final via `deriveCardLabel` (`src/lib/card-label.ts`). **Limite total** = `limit_cents`; **limite disponível** = `limit_cents + saldo do cartão` (= limite − **dívida total** de todas as faturas não pagas; calculado, não armazenado). A "Fatura atual" exibida é a fatura em aberto.
4. **Recorrências**: materializadas até horizonte de **120 dias**, idempotente (por `next_run_date` e contagem), ao abrir a Agenda e ao criar/editar regra. Só receita/despesa em contas não-cartão.
5. **Orçamento**: gasto de **subcategoria soma na categoria-mãe** orçada.
6. **Metas**: independentes das contas (planejamento); aportar não movimenta saldo de conta.
7. **Workflow dev (Windows):** **NUNCA** rodar `npm run build` com o `npm run dev` ativo — ambos usam `.next` e corrompem o CSS. Sequência: parar o Next via **PowerShell** (`Stop-Process` nos node com "next"; `pkill` do bash NÃO funciona no Windows) → `npm run build` → `rm -rf .next` → `npm run dev -- -p 3005`. Dev roda na **porta 3005**.
8. Após mudanças de schema: rodar advisor de segurança do Supabase; funções `SECURITY DEFINER` devem ter `search_path` fixo e `EXECUTE` revogado de anon/authenticated.
9. **Patrimônio** (regra única em `src/lib/networth.ts` → `computeNetWorthNow`): contas arquivadas ignoradas; **passivo** = cartão de crédito (dívida = `max(0, −saldo)`); **ativo** = demais contas pelo saldo + `investments.current_value_cents` (valor atual manual). PL = ativos − passivos. `investments` (aportes/resgates → valor investido; rentabilidade = atual − investido) é **independente das contas**, como as metas. Snapshots em `net_worth_snapshots` (1 por dia; botão "Registrar snapshot"); a evolução mensal retrocede do PL atual pelo resultado (receita−despesa) e usa o snapshot observado quando existe naquele mês.
10. **Importação OFX para cartões**: o OFX do Nubank é SGML (sem fechamento de tags), encoding 1252, FITID reusado (mesmo FITID para transação + encargos). Dedup usa chave composta: `cartão + FITID + data + valor + memo` (nunca só FITID). ACCTID é UUID — mapeado em `ofx_acctid_map` para auto-seleção nos próximos imports. Parser em `src/lib/import-parser.ts` (`parseOfxFile`) é função pura; dedup roda server-side em `importar/actions.ts`.

## Roadmap (14 etapas)
✅ 1 Fundação · ✅ 2 Contas+Categorias/Tags · ✅ 3 Lançamentos · ✅ 4 Dashboard · ✅ 5 Cartões/Faturas · ✅ 6 Agenda/Recorrências · ✅ 7 Orçamentos · ✅ 8 Metas · ✅ 9 Fluxo de caixa e projeções · ✅ 10 Patrimônio e investimentos · ✅ 11 Relatórios + exportação (CSV + PDF via impressão) · ✅ 12 Importação OFX/CSV + conciliação · ✅ 13 Notificações e configurações
✅ 14 Polimento/PWA/testes — PWA configurada (manifest, ícones SVG, service worker, meta tags iOS)
✅ Extra: **anexos/comprovantes** (upload no Storage `anexos`) — implementado 2026-07-05.
✅ Extra: **importação OFX para cartões** — parser SGML Nubank, dedup composta, 1252, ACCTID mapping — implementado 2026-07-05.
> Obs.: 11–13 já estavam no código (não documentados). QA 2026-07-04: lógica de Relatórios e parser de import verificados; **acentuação pt-BR corrigida** em Relatórios, Importação, Notificações, Configurações e **categorias padrão** (migration 0011 recria `seed_default_categories` acentuada + corrige linhas existentes).
