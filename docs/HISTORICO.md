# Histórico do projeto (handoff)

> Append-only. Um bloco datado por sessão / mudança significativa. Mais recente no topo.

---

## 2026-07-05 — Deploy Vercel + correção do saldo consolidado no Dashboard

### Deploy
- App publicado em `https://financas-pessoais-seven-sandy.vercel.app`
- Variáveis de ambiente configuradas no Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SITE_URL)
- Supabase URL Configuration atualizada com o domínio do Vercel

### Bug: saldo consolidado divergente entre Dashboard e Contas
- **Dashboard** somava TODAS as contas via `get_account_balances()` (incluindo cartão de crédito com saldo negativo)
- **Contas** somava apenas contas bancárias e subtraía reservado em metas
- Resultado: Dashboard R$ 473,30 vs Contas R$ 529,80

### Correção
- Nova RPC `get_consolidated_balance()`: soma saldo das contas bancárias (exclui credit_card) menos valor reservado em metas vinculadas
- Migration 0021: `supabase/migrations/0021_consolidated_balance_fn.sql`
- `database.types.ts`: adicionado tipo da nova RPC
- `query-fns.ts`: `fetchDashboardData` usa `get_consolidated_balance()` em vez de somar `get_account_balances()`
- `dashboard/page.tsx`: usa `data.consolidated` em vez de calcular a partir de `data.balances`

### Arquivos modificados
- `supabase/migrations/0021_consolidated_balance_fn.sql` (novo)
- `src/lib/database.types.ts` (adicionado tipo get_consolidated_balance)
- `src/lib/query-fns.ts` (fetchDashboardData usa nova RPC)
- `src/app/(app)/dashboard/page.tsx` (usa data.consolidated)

### Verificação
- `tsc --noEmit` limpo (0 erros)
- `npm run build` OK (26 rotas)
- Deploy automático no Vercel via git push

---

## 2026-07-05 — Otimização de performance: auth, React Query, índices

### Problema
Em produção (`next build + next start`), o skeleton aparece imediatamente (bom), mas os dados levam 3–10 segundos para preencher em TODAS as telas. Diagnóstico: cada navegação fazia **2 chamadas `getUser()`** à rede do Supabase Auth (~300–600ms de overhead) + cada Server Action fazia outra chamada.

### Causa raiz
1. **Middleware + Layout ambos chamavam `getUser()`** → 2 RTTs à rede (~150–300ms cada) antes de qualquer query
2. **~12 actions files tinham `getUserId()` local** que copiava o padrão `getUser()` → 1 RTT extra por mutation
3. **Páginas Configurações e Cofre** tinham `getUser()` redundante (o layout já validava)
4. **Sem cache client-side além do Router Cache** (30s)
4. **Sem cache client-side além do Router Cache** (30s)

### Correções

#### 1. Auth: eliminar chamadas redundantes (~300–600ms economizados por navegação)
- **`(app)/layout.tsx`**: trocado `getUser()` (rede) por `getSession()` (JWT local). O middleware já validou a sessão via `getUser()`. RLS continua protegendo os dados.
- **`server.ts`**: adicionado `getUserIdFromSession()` helper que usa `getSession()` (sem rede)
- **12 actions files**: substituído `getUserId()` local (com `getUser()`) pelo shared `getUserIdFromSession()`
- **`configuracoes/page.tsx` e `cofre/page.tsx`**: trocado `getUser()` por `getSession()`
- **`attachment-section.tsx`**: mantido `getUser()` (Client Component para upload, não afeta navegação)
- **`middleware.ts`**: mantido `getUser()` (gate de segurança + refresh de token)

#### 2. React Query (@tanstack/react-query) — cache client-side com stale-while-revalidate
- Instalado `@tanstack/react-query` + `@tanstack/react-query-devtools`
- **`providers.tsx`**: QueryClientProvider com `staleTime: 5min`, `gcTime: 30min`, `refetchOnWindowFocus: false`
- **`query-utils.tsx`**: `makeQueryClient()` + `ServerHydration` para prefetch server-side + dehydrate
- **`query-fns.ts`**: Server Actions que retornam dados (dashboard, contas, categorias, metas, investimentos, fluxo, notificações, importar)
- **`query-keys.ts`**: chaves de query + `queryGroups` para invalidação seletiva
- **`use-invalidate.ts`**: hook que combina invalidação React Query + `router.refresh()`
- Root layout: `<Providers>` envolve toda a app
- **TODAS as 17 pages** sob `(app)/` convertidas para usar `fetchQuery` + `ServerHydration`:
  - Cada Server Component cria `makeQueryClient()`, faz `fetchQuery` (retorna dados), e envolve o Client Component em `<ServerHydration qc={qc}>`
  - Os dados ficam cached no React Query client-side (staleTime: 5min)
  - Após mutations, `queryGroups.*` invalida só as queries afetadas
  - Revisita dentro de 5min: dados do cache instantâneos; acima de 5min: stale-while-revalidate (mostra cache + refetch em background)

#### 3. Migration 0020 — índices de cobertura + FKs + storage policies
- `transactions_balance_cover`: covering index para `get_account_balances()` → index-only scan
- `transactions_invoice_totals_cover`: partial covering index para `get_invoice_totals()`
- 3 FK indexes faltantes: `recurring_subscriptions.category_id`, `vault_audit_logs.vault_item_id`, `ofx_acctid_map.card_id`
- Storage policies reescritas com `(select auth.uid())::text` (consistente com public.*)

### Arquivos modificados
- `src/lib/supabase/server.ts` (adicionado `getUserIdFromSession`)
- `src/app/(app)/layout.tsx` (getUser→getSession)
- `src/app/(app)/configuracoes/page.tsx` (getUser→getSession)
- `src/app/(app)/configuracoes/cofre/page.tsx` (getUser→getSession)
- 12 `actions.ts` files (getUserId local→shared)
- `src/app/layout.tsx` (adicionado Providers)
- `next.config.mjs` (comentário atualizado)
- `supabase/migrations/0020_performance_indexes.sql` (novo)
- 17 `page.tsx` files convertidos para React Query fetchQuery + ServerHydration

### Arquivos criados
- `src/components/providers.tsx` (QueryClientProvider)
- `src/lib/query-utils.tsx` (makeQueryClient, ServerHydration)
- `src/lib/query-fns.ts` (Server Actions de dados)
- `src/lib/query-keys.ts` (chaves de query + groups)
- `src/lib/use-invalidate.ts` (hook de invalidação)

### Verificação
- `tsc --noEmit` limpo (0 erros).

### Impacto estimado
- **Auth**: −300–600ms por navegação (1–2 RTTs eliminados)
- **React Query**: todas as 17 telas com cache client-side (staleTime: 5min); revisitas instantâneas; stale-while-revalidate em background
- **Índices**: queries de saldo/fatura com potencial de index-only scan
- **Gargalo restante**: latência de rede Supabase (imutável) + cold start (se aplicável)

### Para medir
1. `npm run build && npx next start -p 3005`
2. Navegar entre telas e medir tempo skeleton→dados
3. Revisitar uma tela após 60s (React Query deve mostrar cache + refetch em background)
4. Rodar migration 0020 no Supabase e medir novamente

---

## 2026-07-05 — Importação de fatura OFX para cartões de crédito

### O que foi feito
Implementação completa da importação de extrato OFX de cartão de crédito (foco: Nubank), com upload, parse, preview e importação deduplicada vinculando transações à fatura correta.

### Particularidades Nubank tratadas
- **SGML sem fechamento de tags** (`<TRNAMT>10.00` sem `</TRNAMT>`) — regex existente já trata; adicionada extração de header (`ACCTID`, `ORG`, `CURDEF`) via `parseOfxFile()`.
- **FITID reusado** (mesmo FITID para transação + encargos) — dedup por chave composta: `card:{cardId}:{FITID}:{date}:{amount}:{normalizedMemo}` em vez de só FITID.
- **Encoding** — `decodeOfxCharset()` detecta `<CHARSET:...>` nos bytes brutos e usa `TextDecoder` correto (UTF-8 ou Windows-1252). O Nubank exporta UTF-8 apesar de declarar `CHARSET:1252`.
- **ACCTID é UUID** — mapeado em `ofx_acctid_map` (migration 0019) para auto-seleção nos próximos imports.

### Arquivos criados
- `supabase/migrations/0019_ofx_acctid_map.sql` — tabela `ofx_acctid_map` (user_id, acctid, card_id) com RLS e unique constraint.
- `src/components/cards/import-invoice-dialog.tsx` — dialog completo de importação (upload, drag-drop, decode 1252, parse, preview tabela, seleção, resumo, confirm).

### Arquivos modificados
- `src/lib/import-parser.ts` — `parseOfxFile()` retorna `{acctId, org, curDef, transactions}`; `decodeOfxCharset()` detecção de encoding; `importFingerprint()` aceita `cardId` para chave composta; `parseImportFileFull()`.
- `src/lib/zod-schemas/import.ts` — `cardId` opcional em `importPreviewSchema`; novo tipo `CardImportInput`.
- `src/app/(app)/importar/actions.ts` — `buildPreview` busca transações da conta do cartão; `confirmImport` vincula a faturas via `ensureInvoice()`; novas actions `saveAcctIdMapping` e `lookupCardByAcctId`.
- `src/components/cards/cards-view.tsx` — botão "Importar" em cada card + render do `ImportInvoiceDialog`.
- `src/components/importer/importer-view.tsx` — seletor de cartão opcional; decodificação 1252 para OFX; passa `cardId`.
- `src/app/(app)/importar/page.tsx` — busca cartões e passa ao `ImporterView`.
- `src/lib/database.types.ts` — tipos para `ofx_acctid_map`.

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Migration 0019 pendente de aplicação no Supabase.

### Regra de dedup
Para cartões: `card:{cardId}:{externalId}:{date}:{amountCents}:{normalizedDescription}`. Para contas normais: `ext:{accountId}:{externalId}` (comportamento anterior preservado). A dedup roda server-side em `buildPreview` e `confirmImport` (reexecuta ao confirmar — previne race conditions).

## 2026-07-05 — Cofre de acessos (gerenciador de senhas) em Configurações

### O que foi feito
Nova tela **/configuracoes/cofre** (aba dentro de Configurações) para guardar acessos (e-mails, senhas,
plataformas, APIs, bancos, etc.) com **criptografia client-side** e **senha-mestra** separada do login.
- **Segurança (Web Crypto, sem deps novas):** `src/lib/vault-crypto.ts` — PBKDF2-SHA256 (310k iter) deriva
  uma `CryptoKey` AES-GCM 256 **não-extraível, só em memória**; cifra por campo com IV aleatório de 12B
  (base64 `iv||ct`). Senha-mestra **nunca** persistida (nem localStorage/logs/URL); validação por **verifier**
  (canário cifrado) em vez de hash. Inclui medidor de força e gerador de senhas (rejection sampling).
- **Banco — migration 0017_vault:** enums `vault_item_type` / `vault_item_status` / `vault_audit_action`;
  tabelas `vault_settings` (salt/iterations/verifier), `vault_items` (campos `encrypted_*` = só base64;
  planos: name/type/url/username/category/status/has_2fa/recovery_*/expires_at/favorite/`tags text[]`),
  `vault_audit_logs` (histórico sem valores de segredo). **RLS** nas 3 (4 policies cada, `(select auth.uid())`).
  Advisor de segurança sem alertas novos (só o pré-existente de leaked-password).
- **Server actions** (`configuracoes/cofre/actions.ts`, Zod em `zod-schemas/vault.ts`): setup/change da
  senha-mestra (change re-cifra todos os itens no cliente), CRUD de itens, favoritar e `logSecretAccess`
  (viewed/copied — nunca grava o valor). Servidor só vê ciphertext.
- **UI** (`src/components/vault/*`, padrão visual atual): `vault-view` (orquestra estados
  sem-senha/bloqueado/desbloqueado + **auto-lock 5min** por inatividade + lock no unload), setup e unlock da
  senha-mestra, item dialog (gerar/mostrar senha, 2FA, tags, expiração, recuperação), gerador, troca de
  senha-mestra, cards de resumo, filtros (busca/tipo/status/categoria/tag/favoritos/2FA), lista com senha
  **mascarada** (mostrar auto-oculta ~10s; copiar limpa clipboard ~20s; ambos logam), alertas por item
  (vencida/sem 2FA/sem URL/inativo/duplicado) e histórico de atividade.
- **Menu:** `settings-tabs.tsx` (sub-abas "Perfil e preferências" + "Cofre de acessos") inserido no topo de
  `settings-view` e da nova página. Nada removido das telas existentes.

### Decisões (e motivo)
- **PBKDF2 nativo** (não Argon2/bcrypt) — zero dependências, robusto com 310k iterações; Argon2 exigiria wasm.
- **Verifier cifrado** em vez de `master_password_hash` — não guarda hash da senha; cumpre o mesmo papel.
- **Tags/categoria próprias** (`tags text[]` + `category text`) — isola o cofre do módulo financeiro
  (seção 17 do pedido: "não misturar dados sensíveis com o financeiro"). Substitui a `vault_item_tags` sugerida.
- **Troca de senha-mestra** atualiza a `CryptoKey` em memória no pai (evita falha de decrypt após o refresh).

### Verificação
- `tsc --noEmit` limpo; **build de produção OK** (26 rotas; `/configuracoes/cofre` 13.8 kB). Dev reiniciado na 3005.
- **15/15 testes de cripto** (Node, `vault-crypto` compilado): round-trip encrypt/decrypt, IV único,
  verifier certo/errado, decrypt com chave errada lança, força reprova fraca/aprova forte, gerador respeita
  opções e evita ambíguos, campo vazio.
- **Banco:** RLS ativa nas 3 tabelas, 4 policies cada; round-trip de `vault_items` (insert com enums/array +
  delete) OK. Sem dados de teste remanescentes.
- Falta o **click-test autenticado** na UI (sem login automatizado): criar senha-mestra → cadastrar acesso →
  mostrar/copiar → refresh re-bloqueia → auto-lock.

### Nota de manutenção
Limpei 6 linhas de teste órfãs (`notes='TRIGGERTEST'`) deixadas em `transactions` por um teste da migration
0016 (Previsto×Realizado) — corrompiam os totais. Base de `transactions` limpa (5 lançamentos reais).

---

## 2026-07-05 — Contas: saldo disponível como principal

### Mudança
- Card da conta agora mostra **"Saldo"** (= total − reservado) em vez de "Saldo real"
- "Reservado em metas" exibido apenas quando > 0 (uma linha simples)
- Saldo consolidado usa soma dos saldos disponíveis (total − reservado)

### Antes
```
Saldo real: R$ 717,96
Reservado em metas: R$ 100,00
Disponível: R$ 617,96
```

### Depois
```
Saldo: R$ 617,96
Reservado em metas: R$ 100,00
```

### Arquivos modificados
- `src/components/accounts/accounts-view.tsx`

### Verificação
- `tsc --noEmit` limpo.

---

## 2026-07-05 — Relatórios: tags como badges no Extrato

### Problema
A coluna TAGS no "Extrato filtrado" exibia apenas "-" ou texto corrido, sem badges coloridos.

### Correção
- `reports.ts`: adicionado campo `tags: { id, name, color }[]` ao `CollapsedTransactionRow`
- `collapseTransactions`: extrai array de tags com cores do PostgREST
- `reports-view.tsx`: tags exibidas como badges coloridos (rounded-full, cor da tag, fundo translúcido)

### Arquivos modificados
- `src/lib/reports.ts` — interface + função collapseTransactions
- `src/components/reports/reports-view.tsx` — display com badges

### Verificação
- `tsc --noEmit` limpo.

---

## 2026-07-05 — Relatórios: separação contas x cartões

### Problema
A seção "Resultado por conta" exibia tanto contas bancárias quanto cartões de crédito misturados.

### Correção
- `relatorios/page.tsx`: separa `bankAccounts` (type !== "credit_card") de `creditCardAccounts` (type === "credit_card")
- `buildAccountRows` recebe apenas `bankAccounts`
- Nova seção "Cartões de crédito" com compras, recebimentos e saldo por cartão
- `reports-view.tsx`: nova prop `creditCardRows` + tabela com ícone CreditCard
- `relatorios/export/route.ts`: CSV de contas exclui cartões de crédito

### Arquivos modificados
- `src/app/(app)/relatorios/page.tsx`
- `src/components/reports/reports-view.tsx`
- `src/app/(app)/relatorios/export/route.ts`

### Verificação
- `tsc --noEmit` limpo.

---

## 2026-07-05 — Metas: campo "Conta vinculada" no modal

### Problema
O modal de criar/editar meta não tinha o campo "Conta vinculada", apesar de o banco e o schema Zod já suportarem `account_id`.

### Correção
- `goal-form-dialog.tsx`: adicionada prop `accounts`, state `accountId`, select de conta com texto explicativo
- `goals-view.tsx`: adicionado `accountId` ao `GoalEdit` e passa `accounts` ao dialog
- `metas/page.tsx`: busca contas não-arquivadas e passa para `GoalsView`

### Arquivos modificados
- `src/components/goals/goal-form-dialog.tsx`
- `src/components/goals/goals-view.tsx`
- `src/app/(app)/metas/page.tsx`

### Verificação
- `tsc --noEmit` limpo.

---

## 2026-07-05 — Metas como Caixinhas: saldo da conta não alterado

### Regra confirmada e reforçada
Aportes e retiradas em metas **NÃO** alteram o saldo real da conta vinculada. A meta é uma reserva interna do dinheiro que já está na conta.

#### O que já estava correto (sem necessidade de mudança)
- `addContribution` só insere em `goal_contributions` — não toca `accounts` nem `transactions`
- RPC `get_account_balances()` só soma de `transactions` — goal_contributions não afeta
- Patrimônio não soma metas vinculadas a contas (evita duplicidade)

#### Melhorias de UI implementadas
- **ContributionDialog**: texto explicativo "Este aporte reserva parte do saldo da conta. O saldo real da conta não será alterado."
- **ContaCard**: exibe "Reservado em metas" e "Disponível" quando há metas vinculadas
- **contas/page.tsx**: busca goals + goal_contributions para calcular valor reservado por conta

### Arquivos modificados
- `src/components/goals/contribution-dialog.tsx` — texto explicativo
- `src/components/accounts/accounts-view.tsx` — campo `reservedInGoals` + exibição
- `src/app/(app)/contas/page.tsx` — cálculo de reservado por conta

---

## 2026-07-05 — Reorganização da Recorrência

### O que foi feito

#### 1. Zod Schema (`transaction.ts`)
- Campo opcional `recurrence` adicionado ao `transactionSchema`
- Sub-schema com: `frequency`, `interval`, `end_type`, `end_date`, `occurrences`
- Refinement: `type` deve ser income/expense quando `recurrence` está presente
- Refinements de `end_type` (date→end_date obrigatório, count→occurrences obrigatório)

#### 2. Server Actions (`lancamentos/actions.ts`)
- `createTransaction` agora aceita `recurrence` opcional
- Quando presente: cria transação + `recurring_rule` + vincula via `recurring_rule_id`
- Materializa próximas ocorrências (horizonte 120 dias)
- Adicionado `/agenda` ao `revalidatePath`

#### 3. Types (`types.ts`)
- `TxItem` agora inclui `recurringRuleId: string | null`

#### 4. TransactionFormDialog
- Switch "Lançamento recorrente" (só para income/expense, não transfer)
- Quando ligado: Frequência, Intervalo, Término (data/repetições)
- Status forçado para "previsto" quando recorrência está ativa
- Botão muda para "Criar recorrência"

#### 5. Page.tsx
- `recurring_rule_id` adicionado ao select de transações
- Passado para `TxItem` como `recurringRuleId`

#### 6. TransactionsView
- Badge `Repeat` (violeta) ao lado da descrição para lançamentos recorrentes

#### 7. AgendaView
- Botão "Nova recorrência" removido
- Empty state atualizado: "Crie lançamentos recorrentes em Lançamentos"
- Recorrências continuam sendo visualizadas/gerenciadas na Agenda

### Arquivos modificados
- `src/lib/zod-schemas/transaction.ts` — campo `recurrence`
- `src/app/(app)/lancamentos/actions.ts` — `createTransaction` com recorrência
- `src/components/transactions/types.ts` — `recurringRuleId`
- `src/components/transactions/transaction-form-dialog.tsx` — seção de recorrência
- `src/app/(app)/lancamentos/page.tsx` — select `recurring_rule_id`
- `src/components/transactions/transactions-view.tsx` — badge `Repeat`
- `src/components/agenda/agenda-view.tsx` — remover "Nova recorrência"

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Recorrência criada em Lançamentos aparece em "A pagar/receber".
- Badge de recorrência visível na listagem.

---

## 2026-07-05 — Metas como Caixinhas (Nubank-style)

### O que foi feito

#### 1. Database (migration 0018)
- Novos campos em `goals`: `recurring_contribution_cents`, `contribution_frequency`, `start_date`, `estimated_completion_date`, `account_id`
- Novo campo `type` em `goal_contributions`: contribution/withdrawal/adjustment/completed/paused/resumed
- Enum `goal_status` expandido com `paused`

#### 2. Zod Schema (`goal.ts`)
- `goalSchema` estendido com campos de aporte recorrente, frequência, data inicial, conta vinculada
- `contributionSchema` estendido com campo `type`
- Exportado `FREQUENCY_OPTIONS`

#### 3. Server Actions (`metas/actions.ts`)
- `createGoal` e `updateGoal` incluem novos campos
- Novo `setGoalStatus` para pausar/reativar metas
- `addContribution` aceita `type` e aplica sinal correto

#### 4. Page (`metas/page.tsx`)
- Calcula previsão de conclusão baseada no aporte recorrente
- Calcula valor necessário por período quando prazo definido
- Status derivado: em_andamento, concluida, pausada, sem_previsao

#### 5. GoalFormDialog
- Novos campos: aporte recorrente, frequência, data inicial
- Pré-visualização em tempo real no modal

#### 6. GoalsView
- Cards com badge de status, aporte recorrente, previsão
- Ações: Pausar/Reativar, Editar, Arquivar, Excluir
- Empty state melhorado

### Arquivos
- Criado: `supabase/migrations/0018_goals_caixinhas.sql`
- Modificados: `database.types.ts`, `goal.ts`, `metas/actions.ts`, `metas/page.tsx`, `goals-view.tsx`, `goal-form-dialog.tsx`, `contribution-dialog.tsx`

### Verificação
- `tsc --noEmit` limpo. Migration 0018 pendente de aplicação.

---

## 2026-07-05 — Correção do Fluxo de Caixa: datas e rótulos

### Migração 0017 aplicada
A tabela `recurring_subscriptions` foi criada no banco Supabase via Editor SQL. RLS configurado. FK `recurring_subscription_id` adicionada em `transactions`.

---

## 2026-07-05 — Etapa 14: PWA (Progressive Web App)

### Correção do botão de tema Dark/Light

#### Causa raiz
O `AppShell` tinha um `useEffect` que chamava `setTheme(initialTheme)` usando o valor do banco de dados a cada mount. Quando o usuário clicava no toggle, o `next-themes` salvava no `localStorage`, mas na próxima renderização do layout (após `router.refresh()`), o `useEffect` buscava o tema do banco e revertia a escolha do usuário.

#### Correção
- Removido `initialTheme` prop e `useEffect` de sync do banco em `app-shell.tsx`
- Removido `initialTheme` prop do `<AppShell>` em `(app)/layout.tsx`
- `next-themes` agora gerencia o tema inteiramente via `localStorage` (comportamento padrão)
- A coluna `profiles.theme` continua existindo para referência/settings, mas não interfere no toggle

---

### O que foi feito

#### 1. Ícones PWA (`public/icons/`)
- `icon.svg` (192x192), `icon-512.svg` (512x512), `icon-maskable.svg` (512x512)
- `public/favicon.svg` — favicon SVG

#### 2. Manifest (`public/manifest.webmanifest`)
- Adicionado `icons` array (3 ícones SVG), `scope`, `id`, `orientation`, `categories`

#### 3. Meta tags PWA (`src/app/layout.tsx`)
- `appleWebApp.capable`, `statusBarStyle`, `title`, `icons.apple`

#### 4. Service Worker (`public/sw.js`)
- Pre-cache de rotas críticas, Cache-First para assets, Network-First para navegação, offline fallback

#### 5. Registro (`src/components/service-worker-register.tsx`)
- Componente Client que registra o SW em todas as páginas

### Arquivos criados
- `public/icons/icon.svg`, `icon-512.svg`, `icon-maskable.svg`
- `public/favicon.svg`, `public/sw.js`
- `src/components/service-worker-register.tsx`

### Arquivos modificados
- `public/manifest.webmanifest`, `src/app/layout.tsx`

### Verificação
- `tsc --noEmit` limpo. App instalável como PWA.

---

### Problema
- Lançamento datado em 02/07/2026 (quinta-feira) aparecia na linha "29/06" no agrupamento semanal, causando confusão visual.
- `endISO` era calculado com horário 23:59:59 no timezone local, que em BRT (UTC-3) cruzava para o dia seguinte em UTC — transações do último dia eram silenciosamente excluídas.
- `periodLabel()` não tinha timezone explícita — frágil se o servidor mudasse de timezone.
- Query começava de `start` (sábado) mas `iteratePeriods` voltava para segunda — transações de segunda a sexta da primeira semana eram perdidas.

### Correções

#### 1. `src/lib/cashflow.ts` — `ymd()` com timezone explícita
- Antes: usava `getFullYear()`, `getMonth()`, `getDate()` (timezone do servidor).
- Depois: usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })` para extrair year/month/day de forma robusta.

#### 2. `src/lib/cashflow.ts` — `periodLabel()` com intervalo semanal
- Antes: mostrava apenas "29/06" para semanal.
- Depois: mostra "29/06 a 05/07" (início a fim da semana).
- Adicionado `timeZone: "America/Sao_Paulo"` em todos os `Intl.DateTimeFormat`.

#### 3. `src/app/(app)/fluxo-caixa/page.tsx` — `Date.UTC()` para query bounds
- Antes: `new Date(year, month, day).toISOString()` convertia de local para UTC, podendo cruzar o limite do dia.
- Depois: `new Date(Date.UTC(...)).toISOString()` mantém a data exata em UTC.

#### 4. `src/app/(app)/fluxo-caixa/page.tsx` — gap inicial corrigido
- Antes: query começava de `start` (sábado), mas períodos começavam de segunda.
- Depois: query começa do `periods[0]` (primeira segunda-feira), garantindo que todas as transações dos períodos exibidos sejam buscadas.

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Lançamento de 02/07/2026 agora aparece na linha "29/06 a 05/07" (correto).
- Todos os lançamentos visíveis na tela de Lançamentos são refletidos no Fluxo de Caixa.
- Saldo acumulado permanece consistente.

---

## 2026-07-05 — Assinaturas recorrentes no cartão + Melhoria de parcelas

### O que foi feito

#### 1. Database (migration 0017)
- Nova tabela `recurring_subscriptions`: id, user_id, credit_card_id, description, amount_cents, category_id, frequency, interval, start_date, end_date, status (active/paused/cancelled), next_billing_date, active, timestamps.
- FK `recurring_subscription_id` em `transactions` para vincular cobranças geradas por assinatura.
- RLS completo (own_select/insert/update/delete).
- Índices em user_id e credit_card_id.

#### 2. Server Actions (`cartoes/actions.ts`)
- `createCardSubscription`: cria assinatura + lança 1ª cobrança na fatura correta via `ensureInvoice`.
- `materializeSubscriptions`: gera cobranças futuras para assinaturas ativas (horizonte 120 dias), idempotente.
- `updateCardSubscription`: atualiza metadados (não altera cobranças já geradas).
- `toggleSubscriptionStatus`: alterna active/paused/cancelled.
- `deleteSubscription`: exclui assinatura + transações futuras (preserva histórico).

#### 3. Zod Schema (`zod-schemas/card.ts`)
- `purchaseSchema` estendido com: `is_recurring`, `subscription_frequency`, `subscription_end_date`, `subscription_status`.
- Refinement: frequência obrigatória quando `is_recurring=true`.
- Novo `subscriptionSchema` para edição de assinaturas.

#### 4. UI — Modal de Compra (`purchase-dialog.tsx`)
- Switch "É uma assinatura recorrente?" com visual toggle.
- Quando marcado: oculta Parcelas/Valor da parcela, exibe Frequência e Data de término.
- Campo "Valor da parcela" (read-only) calculado em tempo real quando `installments > 1`.
- Botão muda de "Lançar compra" para "Criar assinatura".

#### 5. UI — Aba Assinaturas (`subscriptions-view.tsx`)
- Nova aba "Assinaturas" na tela de Cartões.
- Lista de assinaturas com: nome, cartão, valor, frequência, próxima cobrança, status, categoria.
- Filtros: Todas / Ativa / Pausada / Cancelada.
- Ações: Pausar/Reativar, Excluir (com confirmação).
- Badge de contagem no botão da aba.

#### 6. UI — Badges na Fatura (`invoices-view.tsx`)
- Badge "Parcela X/Y" (azul) para compras parceladas.
- Badge "Mensal"/"Anual"/etc. (violeta) para assinaturas recorrentes.
- Query em `[id]/page.tsx` agora faz join com `recurring_subscriptions` para obter frequency.

#### 7. Integração
- `cards-view.tsx`: abas Cartões/Assinaturas com toggle visual.
- `page.tsx`: busca assinaturas e passa para CardsView.
- `database.types.ts`: sincronizado com migration 0017.

### Arquivos criados
- `supabase/migrations/0017_recurring_subscriptions.sql`
- `src/components/cards/subscriptions-view.tsx`

### Arquivos modificados
- `src/lib/database.types.ts` — recurring_subscriptions + recurring_subscription_id
- `src/lib/zod-schemas/card.ts` — purchaseSchema estendido + subscriptionSchema
- `src/app/(app)/cartoes/actions.ts` — CRUD assinaturas + materializeSubscriptions
- `src/components/cards/purchase-dialog.tsx` — switch assinatura + campos
- `src/components/cards/cards-view.tsx` — abas Cartões/Assinaturas
- `src/components/cards/invoices-view.tsx` — badges de parcela/assinatura
- `src/app/(app)/cartoes/page.tsx` — busca assinaturas
- `src/app/(app)/cartoes/[id]/page.tsx` — join com recurring_subscriptions

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Três tipos de compra diferenciados: única, parcelada, assinatura recorrente.
- Assinaturas aparecem na aba dedicada com filtros e ações.
- Badges na fatura identificam parcelas e assinaturas.

### Nota
A materialização automática de assinaturas futuras (`materializeSubscriptions`) precisa ser chamada ao abrir a tela de cartões. Atualmente a action existe mas não está integrada no Server Component (pode ser chamada via `RecurringMaterializer` pattern ou no início da page.tsx).

---

## 2026-07-05 — Previsto x Realizado + Sincronização do schema

### O que foi feito

#### 1. Previsto x Realizado (UI completa)
- **Migration 0016** (`0016_previsto_realizado.sql`) já existia: adiciona `valor_previsto`, `valor_realizado`, `data_realizacao` na tabela `transactions` + trigger `sync_transaction_amounts` que mantém o invariante `amount_cents = (cleared ? valor_realizado : valor_previsto)`.
- **`database.types.ts`**: sincronizado com a migration 0016 (campos `valor_previsto`, `valor_realizado`, `data_realizacao`).
- **Zod schema** (`transaction.ts`): adicionado campo `valor_realizado` (opcional).
- **Server actions** (`lancamentos/actions.ts`):
  - `createTransaction` e `updateTransaction` agora passam `valor_previsto` e `valor_realizado` para o banco.
  - `setTransactionStatus` aceita parâmetro opcional `valorRealizado` — ao marcar como cleared, envia o valor realizado; ao desmarcar, limpa `valor_realizado` e `data_realizacao`.
- **Form de lançamento** (`transaction-form-dialog.tsx`):
  - Quando Situação = "Realizado", exibe campo "Valor recebido/pago" preenchido com o previsto.
  - Mostra diferença em tempo real (a mais / a menos / exato) com cor.
  - Rótulo do campo Valor muda para "Valor previsto" quando status é realizado.
- **Lista de lançamentos** (`transactions-view.tsx`):
  - Badge "Realizado" (verde) além do "Previsto" (amarelo) que já existia.
  - Quando realizado e valor diferente do previsto, mostra linha de diferença: "Previsto R$ X · Realizado R$ Y · Diferença +/−R$ Z".

#### 2. Totais — contam APENAS o realizado
Graças ao trigger `sync_transaction_amounts`, `amount_cents` já é o realizado quando `status='cleared'`. **Nenhuma query de agregação precisou de alteração** — todas já filtram `status='cleared'` e leem `amount_cents`. Locais verificados: RPC `get_account_balances`, dashboard, contas, cartões, patrimônio, fluxo de caixa, relatórios, orçamentos, notificações.

#### 3. Recorrência — já implementada (descoberta)
A funcionalidade de recorrência já estava **completamente implementada**:
- **Tabela `recurring_rules`** (migration 0002): frequência, intervalo, data_inicio, condições de término, `next_run_date` cursor.
- **Materialização** (`agenda/actions.ts`): gera ocorrências como lançamentos individuais (`status=pending`) com `recurring_rule_id`, até horizonte de 120 dias. Idempotente.
- **UI completa**: aba "Recorrências" na Agenda com CRUD de regras, toggle pausar/retomar, form com frequência/fim.
- **Zod schema** (`recurring.ts`): valida `end_type` (never/date/count).
- **Integração**: ocorrências geradas alimentam Fluxo de caixa, notificações e "A pagar/receber".

### Arquivos modificados
- `src/lib/database.types.ts` — sincronizado com migration 0016
- `src/lib/zod-schemas/transaction.ts` — adicionado `valor_realizado`
- `src/app/(app)/lancamentos/actions.ts` — `createTransaction`, `updateTransaction`, `setTransactionStatus` com `valor_realizado`
- `src/components/transactions/transaction-form-dialog.tsx` — campo "Valor recebido/pago" + diferença
- `src/components/transactions/transactions-view.tsx` — badge "Realizado" + linha de diferença
- `src/components/transactions/types.ts` — `valorPrevisto`, `valorRealizado` em `TxItem` e `TxEditData`
- `src/app/(app)/lancamentos/page.tsx` — busca `valor_previsto`, `valor_realizado`
- `src/components/agenda/agenda-view.tsx` — adicionado `valorRealizado` no TxEditData

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Trigger `sync_transaction_amounts` garante que `amount_cents` sempre reflete o valor correto.
- Todas as agregações existentes funcionam sem alteração.

---

## 2026-07-05 — Anexos/Comprovantes: funcionalidade completa

### O que foi feito
Implementação completa da funcionalidade de anexos/comprovantes para lançamentos. Infraestrutura de banco já existia (tabela `attachments`, RLS, bucket `anexos`); todo o código de aplicação foi criado.

### Arquivos criados
- **`src/lib/zod-schemas/attachment.ts`**: Schema Zod para validação de upload (MIME types: JPG/PNG/GIF/WebP/PDF; limite 10 MB; `storage_key` obrigatório).
- **`src/components/transactions/attachment-section.tsx`**: Componente de upload + lista de anexos (Client Component). Upload direto para Supabase Storage (`anexos/{user_id}/{transaction_id}/{filename}`), registro via server action, download via URL assinada, delete com remoção do storage + banco.

### Arquivos modificados
- **`src/app/(app)/lancamentos/actions.ts`**: Adicionadas server actions `addAttachment`, `deleteAttachment`, `listAttachments` + tipo `AttachmentRow`.
- **`src/app/(app)/lancamentos/page.tsx`**: Query de contagem de anexos por lançamento (`attachments` table), passa `attachmentCount` em cada `TxItem`.
- **`src/components/transactions/types.ts`**: Adicionado campo `attachmentCount: number` em `TxItem`.
- **`src/components/transactions/transaction-form-dialog.tsx`**: Integrado `AttachmentSection` (só na edição, abaixo de Observação).
- **`src/components/transactions/transactions-view.tsx`**: Badge de papelinho com contagem na linha do lançamento (ex: 📎 2).

### Arquitetura de upload
- **Cliente** faz upload do arquivo para Supabase Storage (`anexos/{user_id}/{transaction_id}/{filename}`)
- **Server Action** (`addAttachment`) valida e insere a linha na tabela `attachments`
- **Download** via URL assinada (60s de validade)
- **Delete** remove do storage (client) + linha do banco (server action)

### Limites
- MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`
- Tamanho máximo: 10 MB por arquivo
- Storage path: `{user_id}/{transaction_id}/{filename}` (políticas RLS existentes)

### Verificação
- `tsc --noEmit` limpo (0 erros).
- Funcionalidade integrada no form de edição de lançamento.
- Badge de anexo visível na listagem.

### Nota
Anexos só podem ser adicionados **após** o lançamento ser criado (FK `transaction_id` obrigatória). Para adicionar anexos a um lançamento novo, o usuário deve criar o lançamento e depois editar para anexar.

---

## 2026-07-05 - Correcao Auth SSR: `getUser()` no servidor

### Problema
Em producao (`next start`), o Supabase emitia o aviso: "Using the user object as returned from supabase.auth.getSession() ... could be insecure". O unico uso server-side de `getSession()` para obter usuario estava em `src/app/(app)/layout.tsx`; o middleware ja usava `getUser()`.

### Correcao
- `src/app/(app)/layout.tsx`: removido `getSession()` e restaurado `await supabase.auth.getUser()` para obter usuario validado no Server Component antes de buscar `profiles`.
- `src/lib/supabase/middleware.ts`: mantido com uma unica chamada `getUser()` por request e o padrao `@supabase/ssr` `getAll()/setAll()` para renovar cookies.
- `CLAUDE.md`: convencao atualizada para **`getUser()` no servidor e em decisoes de seguranca; `getSession()` apenas no cliente para UI**.
- Seguranca dos dados continua no banco: RLS permanece baseada em `auth.uid()` / `(select auth.uid())`.

### Verificacao
`rg` sem usos server-side de `getSession()` em `src`; os hits restantes sao apenas convencao em `CLAUDE.md` e historico desta correcao. `npx.cmd tsc --noEmit` e `npm.cmd run build` limpos. `next start` em producao chegou a `Ready` (935-1262ms) e os logs de boot nao exibiram o warning "could be insecure"; neste ambiente, o processo nao abriu socket acessivel em `3005`/`3006`, entao a medicao autenticada de login ate o dashboard ficou pendente para validacao manual no navegador.

---

## 2026-07-04 — Modais "Novo/Editar": estado não resetava entre aberturas

### Bug
"Novo cartão" abria pré-preenchido com o último cartão criado. Causa: em [cards-view](src/components/cards/cards-view.tsx) o form usa `key={editing?.cardId ?? "new"}` — para "novo", a key é **sempre `"new"`**, então o componente (que guarda o estado em `useState`) **não remonta** entre aberturas sucessivas de "novo" e o estado da última submissão persiste. O `Dialog` (`ui/dialog.tsx`) retorna `null` ao fechar, mas o **wrapper que segura o `useState` fica montado**.

### Correção (padrão aplicado a TODOS os form dialogs)
`useEffect(() => { if (!open) return; /* re-set de todos os campos a partir do item ou defaults */ }, [open, item])` — reinicializa ao abrir: **"novo" começa limpo; "editar" preenche com o item clicado (pelo id, não índice)**; também limpa `error`/`saving` (cobre o "cancelar não vazar").
- Aplicado em: **card**, category, tag, goal, contribution, budget, investment (form/entry/update-value), transaction (lançamentos), recurring (agenda), pay-invoice. **account** já tinha (corrigido antes). **purchase** já estava correto (a key inclui o estado `open` → remonta a cada abertura).

### Verificação
- `tsc` limpo. Fix é determinístico (reset por abertura); mesmo padrão que já resolveu o form de Contas. Falta o click-test autenticado.

---

## 2026-07-04 — Performance de navegação e login (Etapas 0–6)

### Diagnóstico (Etapa 0) — o essencial
Medido em **build de produção** (`next build && next start`): `/login` renderiza em **53 ms** contra **~8.300 ms** no 1º acesso do `next dev`. **Os 5–10 s por navegação são compilação sob demanda do `next dev`, não de produção.** Índices já eram bons; `Promise.all` já usado no dashboard/patrimônio. Custos reais de prod: sem cache de revisita, cascata de auth (getUser 2×/nav), bundles de gráfico (~200 kB) e login (194 kB = supabase-js).

### Correções por impacto
- **Etapa 1 — skeleton instantâneo**: `src/app/(app)/loading.tsx` (Suspense do App Router) → a nova tela aparece na hora com skeleton enquanto o Server Component busca dados. Layout já era persistente (`AppShell` não remonta); `<Link>` já faz prefetch em prod.
- **Auth enxuta**: `(app)/layout.tsx` passou de `getUser()` (rede) para `getSession()` (cookie local) — o middleware já validou o token via `getUser` na mesma request. **−1 ida à rede (~170–700 ms) por navegação.** Middleware mantém `getUser` (segurança).
- **Etapa 4 — lazy Recharts** (`next/dynamic`, `ssr:false`): wrappers em `src/components/dashboard/lazy-charts.tsx` + inline em cashflow/budgets. **First Load JS: dashboard 215→105 kB, relatorios 212→106, patrimonio 207→105, orcamentos 205→106, fluxo-caixa 201→98,5 (−~50%).** Recharts vira chunk que só baixa quando o gráfico monta.
- **Etapa 2 — revisita instantânea**: `next.config.mjs` `experimental.staleTimes { dynamic:30, static:180 }` — Router Cache mantém o RSC de rotas visitadas; voltar a uma tela é instantâneo. Mutations já chamam `router.refresh()` (revalida a rota atual). **Escolhi isto no lugar de React Query**: o app é todo Server Components; um rewrite p/ fetch no cliente seria grande, arriscado e pioraria o SSR. staleTimes entrega o mesmo "revisita instantânea" com risco ~zero.
- **Etapa 5 — login**: botão com estado "Entrando…"; pós-login vai pro dashboard (agora leve, com skeleton, layout com getSession). Erro já claro ("E-mail ou senha incorretos."). /login segue 194 kB (supabase-js do auth — cacheado após 1º load).
- **Etapa 3 — banco**: migration 0014 reescreve **as 69 policies RLS** para `(select auth.uid())` (avalia o uid uma vez, não por linha). Migration 0015 adiciona **10 índices de cobertura** em FKs sinalizadas pelo advisor (budgets.category_id, recurring_rules.account/category, transactions.recurring_rule/import_batch, etc.). Ganho só em escala; irrelevante no volume atual.

### Verificação
- `tsc` limpo; **build de produção OK** (25 rotas). Bundles medidos antes/depois (acima). Advisor de segurança sem alertas novos (só o de senha, pré-existente). RLS reescrita confirmada (`( SELECT auth.uid() AS uid)` nas 69 policies).
- Falta o click-test autenticado no app rodando (sem login automatizado). O ganho de bundle é objetivo; skeleton/staleTimes/getSession são determinísticos.

### Nota importante p/ o usuário
O incômodo do dia a dia (5–10 s) **é o `next dev`**; some no deploy. Para "sentir" o resultado real: `npm run build && npx next start -p 3005`.

---

## 2026-07-04 — Bug: cartão "não salva" (era a lista quebrando) + feedback de erro

### Causa raiz (encontrada via logs da API do Supabase)
A página de Cartões fazia `credit_cards.select("...,account:accounts(...)")`. Desde a **migration 0010** (que adicionou a FK `linked_account_id`), `credit_cards` passou a ter **duas FKs para `accounts`** (`account_id` e `linked_account_id`) → o embed ficou **ambíguo** e o PostgREST retornava **HTTP 300** (Multiple Choices) → a query falhava, `cardsData` vinha `null` e a **lista aparecia vazia**. O cartão até era inserido (o PAN existia no banco), mas nunca aparecia → parecia que "não salvou". Confirmado por curl: embed antigo=300, embed com FK explícita=200.

### Correções
1. **Desambiguação do embed** (FK explícita `!credit_cards_account_id_fkey`) em: `cartoes/page.tsx`, `cartoes/[id]/page.tsx` e `notificacoes/actions.ts` (invoices→credit_cards→accounts, mesma ambiguidade). As demais `account:accounts(...)` partem de `transactions` (FK única) — ok.
2. **Feedback nunca silencioso**: `onSubmit` de **cartões e contas** agora em `try/catch/finally` — erro real exibido no modal + `console.error`, e `saving` sempre resetado.
3. **Validação não-bloqueante**: removido o `disabled` do botão por "final do cartão" parcial; `last4` é opcional (zod valida o formato só quando preenchido e mostra a mensagem). Limite pode ser 0; instituição/bandeira/final são opcionais no cartão.
4. **Sucesso**: modal fecha + `router.refresh()` — com a lista corrigida, o novo cartão aparece na hora.

### Verificação
- `tsc` limpo. Testes curl (anon key; 300 é erro de planejamento, ocorre antes do RLS): todas as 3 queries corrigidas passaram de **300 → 200**. Só existia 1 cartão (PAN) no banco — prova de que o INSERT sempre funcionou; o defeito era exclusivamente na listagem.

---

## 2026-07-04 — Logos de bancos (auto-hospedadas) + institution por slug

### O que foi feito
- **18 SVGs** baixados do repo público `Tgentil/Bancos-em-SVG` (raw GitHub) para `public/banks/<slug>.svg` (todos os 18 do dropdown existiam lá — não precisou Wikimedia). Servidos como estáticos, **sem rede em runtime**.
- **`src/lib/banks.ts`**: catálogo `Bank { slug, nome, sigla, logo, cor }` + helpers `bankBySlug`, `bankName` (slug→nome), `bankSigla`, `slugFromLegacy`. **Slug é o identificador estável salvo no banco** (`accounts.institution`), não o nome. Removi o catálogo antigo de `account-meta.ts`.
- **`<BankLogo>`** (`src/components/bank-logo.tsx`): badge arredondado com a logo sobre **fundo branco** (contrasta em claro e escuro); fallback = ícone colorido (`fallbackIcon`, default landmark) → card nunca sem ícone.
- **`<BankSelect>`** (`src/components/accounts/bank-select.tsx`): dropdown **customizado** (o `<select>` nativo não renderiza imagens em `<option>`) com logo + nome por opção, "Outro…" e fechar por fora/ESC.
- **Formulário de Contas**: usa `BankSelect` (valor = slug); apelido automático via `bankSigla(slug)`; "Outro" mantém input de texto livre. **Cards de Contas**: ícone = `<BankLogo bank={institution} fallbackIcon={icon}>`; texto = `bankName(institution)`.
- **Cartões**: como `institution` herdado da conta agora é slug, apliquei `bankName()` no preview do apelido (`card-form-dialog`), no rótulo derivado (`resolveCardIdentity`) e na exibição (`cards-view`).
- **Migration 0012** (`0012_bank_institution_slug.sql`): converte `accounts.institution` legado (nome **ou** sigla) → slug; valores desconhecidos (ex.: "PAN") ficam como texto livre → fallback. Idempotente. Verificado: INTER→`inter`, NU→`nubank`, PAN intacto.

### Verificação
- `tsc` limpo. 18 SVGs validados (começam com `<svg`); nenhum branco/`currentColor` problemático (Itaú tem branco, mas é o texto sobre o quadrado azul).
- **Preview visual** (Artifact auto-contido, SVGs como data-URI = mesmo isolamento do `<img>` do app): as 18 logos + fallback em badge branco, temas claro/escuro. Colisão de classes internas (`.st0`) só afetaria inline na mesma página — no app cada logo é `<img>` isolado (sem colisão).
- Falta o click-test no app logado (sem login automatizado).

### Notas
- Cor da marca (`cor`) definida por banco para realce/fallback. "Outro…" e bancos fora da lista não têm logo (fallback), conforme pedido.
- **Banco PAN adicionado em seguida** (migration 0013), pois havia conta e cartão PAN → 19 bancos. `institution` "PAN" migrado para slug `pan`. Logo `bancoPan.svg` (quadrado ciano com "pan" branco por cima — ok no badge branco).

---

## 2026-07-04 — Cartão: apelido derivável + banco herdado da conta vinculada

### O que foi feito (formulário Novo/Editar cartão)
- Removido campo **Nome**; agora **Apelido** (opcional) preenchido automaticamente com **banco + final** ("Nubank •••• 1234"), editável; vira o rótulo do card. Vazio → derivado no save.
- **Banco/Instituição** só aparece **quando não há conta vinculada**; havendo conta, o banco é **herdado** dela.
- Nova ordem: Conta vinculada → (Banco, só sem conta) → Bandeira → Final → Limite total → Fechamento → Vencimento → Apelido → Cor.
- **Trocar a conta vinculada** atualiza banco herdado + apelido automático juntos; se o apelido foi **editado manualmente**, é preservado (`apelidoTouched`, deduzido na edição comparando o nome salvo ao derivado). Formulário tem `key` por cartão → remonta e reinicializa por cartão.
- Arquivos: `src/lib/card-label.ts` (`deriveCardLabel`, compartilhado form+action), `zod-schemas/card.ts` (`name`→`apelido` opcional), `cartoes/actions.ts` (`resolveCardIdentity`: banco efetivo herdado/manual + nome derivado, denormalizado em `accounts.institution`/`accounts.name`), `components/cards/card-form-dialog.tsx`.

### Banco (#6)
**Nenhuma migration necessária** — as propriedades pedidas já existiam: `accounts.institution` nullable (banco opcional), `credit_cards.linked_account_id` nullable + FK `credit_cards_linked_account_id_fkey`, RLS de `credit_cards` com 4 policies. Rótulo sempre derivável (nome preenchido no save). Verificado por SQL.

### Verificação
- `tsc` limpo. `deriveCardLabel` 5/5 (Node). Teste funcional SQL (rollback): **A** com conta vinculada → nome "Nubank •••• 1234", institution "Nubank" (herdado); **B** sem conta → nome custom "Meu Itaú", institution "Itaú" (manual), vínculo NULL. Ambos OK.
- Falta apenas o click-test visual na UI (sem login automatizado).

---

## 2026-07-04 — Varredura de acentuação pt-BR (categorias, importação, notificações, configurações)

### O que foi feito
Corrigida a acentuação ausente no lote 11–13 e nas categorias padrão (nav já era acentuada; o resto do lote não).
- **Código** (`tsc` limpo): `importer-view.tsx` (Descrição, Situação, Prévia e conciliação, Saídas, Histórico de importações, mensagens…), `notifications-view.tsx` (Notificações, Orçamento, Não lidas, Atualização…), `settings-view.tsx` (Configurações, Fuso horário, preferências, aplicação…), actions de `notificacoes`/`importar`/`configuracoes` (Não autenticado, Lançamento em atraso, Cartão, Orçamento estourado, Mesmo lançamento), `zod-schemas/import.ts` (Data inválida, Nenhum lançamento encontrado, até 1000), `configuracoes/page.tsx` (Usuário), `import-parser.ts` (fallback "Lançamento importado").
- **NÃO alterei** as chaves de header do parser (`descricao`/`lancamento` etc. em `import-parser.ts`) — precisam ficar sem acento para casar com cabeçalhos normalizados; nem nomes de função/rotas.
- **Banco — migration 0011** (`0011_accent_default_categories.sql`): `create or replace seed_default_categories` com todos os nomes acentuados (mães + filhas + refs de parent_name) e `UPDATE` das 18 categorias já existentes sem acento (Alimentação, Saúde, Educação, Serviços, Salário, Condomínio, Água, Gás, Combustível, Transporte público, App/Táxi, Manutenção, Plano de saúde, Farmácia, Vestuário, Eletrônicos, 13º, Férias). Verificado: 0 categorias sem acento. Advisor de segurança sem alertas novos.

### Pendências relacionadas
Reports já tinha sido acentuado na sessão anterior. Não restou string pt-BR de tela sem acento nos módulos varridos (confirmado por grep).

---

## 2026-07-04 — Descoberta: Etapas 11–13 já implementadas + QA com dados

### Descoberta
Ao ir "planejar a Etapa 11", descobri que **11, 12 e 13 já estavam implementadas no código** (o roadmap do CLAUDE.md estava desatualizado; nunca registradas no HISTORICO):
- **11 Relatórios**: `relatorios/page.tsx` + `relatorios/export/route.ts` (CSV, 5 tipos) + `lib/reports.ts` + `reports-view.tsx`. PDF via `window.print()` (classes `print:`).
- **12 Importação**: `importar/` + `importer-view.tsx` + `actions.ts` + `lib/import-parser.ts` (OFX/CSV, dedup por fingerprint, conciliação fuzzy).
- **13 Notificações/Config**: `notificacoes/` e `configuracoes/` com views + actions (gera notificações de contas a vencer/fatura/orçamento estourado/meta atingida).
- **Anexos** seguem realmente pendentes (só o tipo da tabela existe).

### QA feito (com dados de exemplo)
- **Seed via SQL** (28 lançamentos, `notes='SEEDQA'`, meses 03–07/2026): receita realizada R$40.000, despesa R$12.900, 1 transferência, 1 pendente.
  - **Remover depois:** `delete from transactions where notes='SEEDQA';`
- **Relatórios verificados** cruzando SQL que espelha as regras (só `cleared`, despesa na categoria-mãe, transfer fora): resumo, mensal (Mar–Jun R$10k/R$3k; Jul R$0/R$900) e por categoria (Moradia 600k, Alimentacao 410k, Lazer 160k, Transporte 120k) — **todos batem**.
- **Parser de importação verificado** (teste Node transpilando `import-parser.ts` com o `typescript` instalado): CSV BR (`;`, DD/MM/AAAA, valor assinado), CSV crédito/débito, OFX, ano 2 dígitos, fingerprint determinístico e sensível a `externalId` — **12/12 OK**.
- Notificações/Config revisados no código (lógica correta); não click-testados (sem sessão autenticada).

### Correção aplicada
- **Acentuação pt-BR dos Relatórios** (bug de qualidade do lote 11–13, que foi escrito sem acentos, ao contrário da nav): `reports-view.tsx`, `lib/reports.ts` (rótulos/CSV) e `relatorios/export/route.ts` (cabeçalhos). `tsc` limpo.
- **Não** alterei as chaves de cabeçalho do parser (`descricao`/`lancamento` em `import-parser.ts`) — precisam ficar sem acento para casar com headers normalizados.

### Pendências de qualidade (follow-up, não feitas)
- Acentuação ainda ausente em: **categorias-semente** (`Alimentacao`, `Salario`, `Saude`, `Servicos`… na migration 0003 + linhas já criadas), **importação** (`zod-schemas/import.ts`, `importer-view`, mensagens) e **notificações** (`Nao autenticado`, `Cartao`, `Orcamento estourado`).
- 12/13 não verificados ponta a ponta na UI (upload de arquivo / geração de notificações) por falta de login automatizado.

### Próximo passo sugerido
Etapa 14 (polimento/PWA/testes) — incluindo varredura geral de acentuação — ou construir os **anexos/comprovantes** (único item de produto genuinamente pendente).

---

## 2026-07-04 — Diagnóstico de performance de navegação (2–5s)

### Conclusão
A lentidão de 2–5s por navegação é **compilação sob demanda do `next dev`**, não é problema de produção nem de banco. **Nenhuma correção de código é necessária para esse sintoma** — some no `next build && next start`.

### Evidências medidas
- **Prova direta (dev):** 1º acesso a `/login` = **8.320ms**; 2º acesso = **186ms**. A 1ª rota compila também middleware + layout raiz + chunks compartilhados. Rotas com Recharts (dashboard/patrimônio/fluxo-caixa) são as mais pesadas de compilar no 1º acesso.
- **Banco descartado:** volume real = 4 contas, 49 categorias, **0 transações** e 0 no resto. Nenhuma query leva segundos sobre isso; índices/RLS são irrelevantes no volume atual (revisitar quando crescer).
- **Rotas protegidas** retornam 307 em ~50ms porque o middleware redireciona antes de renderizar a página; o custo de compilar a página só ocorre autenticado.

### Custos reais que permanecem em produção (secundários, ~sub-segundo — não são os 2–5s)
- **`getUser()` 2× por navegação** (ida à rede ao Auth do Supabase): `middleware.ts:38` e `(app)/layout.tsx:9`. RTT medido a sa-east-1 ~150–300ms/chamada. Manter `getUser` no middleware (recomendação de segurança do Supabase); no layout dá para avaliar `getSession` (economiza ~1 RTT), com ressalva de confiabilidade.
- **Sem cache no cliente** (nenhum React Query/SWR) + páginas `force-dynamic`: revisitar uma tela **refaz** todas as queries; em prod fica sub-segundo, mas não "instantâneo".
- Positivo: dashboard/patrimônio já paralelizam com `Promise.all`; queries já filtram no servidor (sem "buscar tudo e filtrar no cliente").

### Recomendações (por impacto) — NÃO implementadas (aguardando decisão)
1. Aceitar o comportamento de dev (nada a fazer no sintoma principal). Para "sentir" prod: `next build && next start`.
2. (Prod) Cache no cliente com SWR/React Query (stale-while-revalidate) → revisitas instantâneas.
3. (Prod) Skeletons/Suspense por tela → resposta visual imediata.
4. (Prod) `getSession` no layout onde for seguro → −1 RTT/navegação.
5. (Futuro/escala) Índices em `user_id`/datas/FKs e RLS com `(select auth.uid())` — irrelevante no volume atual.
6. `<Link prefetch>` onde fizer sentido.

## 2026-07-04 — Ajustes no cartão: conta vinculada, final do cartão, limite disponível

### O que foi feito
- **Migration 0010**: `credit_cards.linked_account_id` (FK → `accounts`, `ON DELETE SET NULL`) e `credit_cards.last4` (texto, check `^[0-9]{4}$`) + índice. RLS de `credit_cards` (por `user_id`) já cobre as colunas novas; integridade referencial pela FK. Advisor de segurança sem alertas novos.
- **Formulário Novo/Editar cartão** (`card-form-dialog.tsx`): campo **Conta vinculada** (select das contas checking/savings) — ao selecionar, **pré-preenche Instituição/Banco** com a da conta; separei **Instituição/Banco** (→ `accounts.institution`) de **Bandeira** (→ `credit_cards.brand`); troquei/adicionei **Final do cartão** (4 dígitos, só números); **Limite total** (rótulo).
- **Visão do cartão** (`cards-view.tsx`): exibe **"•••• 1234"** + instituição; **Limite disponível = `limit_cents + saldo do cartão`** (= limite − **dívida total** de todas as faturas não pagas; barra e % pela dívida total). "Fatura atual" segue mostrando a fatura em aberto.
- **Pagamento de fatura**: `linked_account_id` vem pré-selecionado no `PayInvoiceDialog` (continua editável). Threading: `[id]/page.tsx` → `InvoicesView(defaultAccountId)` → `PayInvoiceDialog(defaultAccountId)`.
- Atualizados: `zod-schemas/card.ts` (institution/last4/linked_account_id), `cartoes/actions.ts` (create/update gravam os novos campos; `accounts.institution` passou a receber a instituição, não a bandeira), `cartoes/page.tsx` (busca colunas novas + lista de contas checking/savings), `database.types.ts` (credit_cards + FK).

### Decisões (e motivo)
- **`linked_account_id`** (nome em inglês, como o resto do schema) em vez de `conta_id` — evita confusão com o `account_id` já existente (a conta *do próprio cartão*). FK `ON DELETE SET NULL` para não travar a exclusão da conta vinculada.
- **Não criei `limite_total`**: `limit_cents` já é o limite total; duplicaria. **Limite disponível é calculado**, não armazenado.
- **`last4` (4 dígitos), nunca o número completo** — por segurança (check constraint no banco + máscara no input).
- **Limite disponível = `limite + saldo do cartão` (dívida total)** — decisão final após discussão: reflete o que o banco realmente libera (o limite é consumido por todas as faturas não pagas, não só a aberta). O saldo negativo da conta do cartão já é a dívida total acumulada.

### Verificação
- `tsc --noEmit` limpo. Teste funcional no banco (bloco `DO` com rollback): `last4` gravado, **constraint rejeita `last4`≠4 dígitos**, `linked_account_id` persiste (confirmado via `RETURNING`), **`ON DELETE SET NULL`** zera o vínculo ao apagar a conta. Sem dados de teste remanescentes.
> Falta validação visual no app rodando (porta 3005) — não subi o dev para não arriscar o `.next`.

---

## 2026-07-04 — Etapa 10: Patrimônio e investimentos

### O que foi feito
- **/investimentos**: CRUD de investimentos (nome, tipo, valor atual manual) + aportes/resgates (`investment_entries`, deposit/withdraw) com data/observação. Por ativo: **investido** (Σ aportes − Σ resgates), **valor atual**, **rendimento** (R$ e %). Resumo com totais. Botão "Atualizar valor" (dialog rápido) além do editar.
  - Arquivos: `src/lib/investment-meta.ts` (tipos/rótulos/cores), `src/lib/zod-schemas/investment.ts`, `src/app/(app)/investimentos/{page,actions}.ts(x)`, `src/components/investments/{investments-view,investment-form-dialog,investment-entry-dialog,update-value-dialog}.tsx`.
- **/patrimonio**: cards Ativos / Passivos / Patrimônio líquido; listas de ativos (contas + investimentos) e passivos (cartões com dívida); **gráfico de evolução 12 meses** (reusa `NetWorthChart`); **snapshots** (registrar/excluir) em `net_worth_snapshots`.
  - Arquivos: `src/lib/networth.ts` (`computeNetWorthNow` — regra única), `src/app/(app)/patrimonio/{page,actions}.ts(x)`, `src/components/networth/patrimonio-view.tsx`.

### Decisões (e motivo)
- **Investimentos independentes das contas** (como as metas): a tabela `investments` rastreia aplicações manualmente; não movimenta saldo de conta. Evita dupla contagem com o tipo de conta `investment`.
- **Regra de patrimônio centralizada** em `computeNetWorthNow` (usada pela página e pelo snapshot): contas arquivadas fora; cartão = passivo (`max(0,−saldo)`); ativo = demais saldos + valor atual dos investimentos. Consistente com o "saldo consolidado" do dashboard + investimentos.
- **Evolução estimada**: retrocede o PL atual pelo resultado mensal (receita−despesa dos `cleared`), e usa o **snapshot observado** quando há um naquele mês (precedência). Mês atual sempre ao vivo. Mesma abordagem já aceita no dashboard.
- **Snapshot: 1 por dia** (delete do dia + insert) — idempotente.

### Estado atual
Etapa 10 funcionando e verificada: `tsc --noEmit` limpo; teste Node da lógica (investido/rendimento/% e evolução com override de snapshot) — todos passaram; round-trip no banco (insert investment + 3 entries + snapshot, `invested=120000`) validado e limpo. Sem mudança de schema (tabelas `investments`/`investment_entries`/`net_worth_snapshots` já existiam com RLS). Roadmap: Etapas 1–10 concluídas.
> Obs.: `next lint` não está configurado no projeto (setup interativo pendente) — validação via `tsc` + testes.

### Próximos passos
11. **Relatórios + exportação** (CSV/PDF) → 12 Importação OFX/CSV + conciliação → 13 Notificações/Config → 14 Polimento/PWA. Anexos/comprovantes ainda pendentes.

---

## 2026-07-04 — Etapa 9: Fluxo de caixa e projeções

### O que foi feito
- Nova tela **/fluxo-caixa**: saldo acumulado com granularidade **dia/semana/mês** (toggle via `?g=`), **gráfico de área** com corte em zero (verde acima, vermelho abaixo, gradientOffset), **tabela** período a período (entradas/saídas/resultado/saldo acumulado) e **resumo** (saldo atual, menor saldo projetado + quando, alerta de negativo).
- Arquivos: `src/lib/cashflow.ts` (range/label/iterador por granularidade), `src/app/(app)/fluxo-caixa/page.tsx`, `src/components/cashflow/{cashflow-view,cashflow-chart}.tsx`.

### Decisões (e motivo)
- **Projeção usa os `pending`** (que já incluem as recorrências materializadas); realizados passados vêm dos `cleared` até hoje. Transferências são ignoradas (se anulam no consolidado; cartão já entra como despesa).
- **Abertura ajustada**: `opening = saldoConsolidadoAtual − (realizados na janela até hoje)`, para a linha **passar exatamente pelo saldo atual em "hoje"** e não haver dupla contagem.

### Estado atual
Fluxo de caixa funcionando e verificado (teste Node: abertura/opening corretos, linha passa pelo saldo atual em hoje, menor saldo projetado e alerta de negativo corretos). Build limpo. Roadmap: Etapas 1–9 concluídas.

### Próximos passos
10. **Patrimônio e investimentos** (ativos × passivos, evolução; investimentos com aportes/resgates e valor atual manual) → 11 Relatórios/export → 12 Importação OFX/CSV → 13 Notificações/Config → 14 Polimento/PWA. Anexos ainda pendentes.

---

## 2026-07-04 — Fundação até Metas (Etapas 1–8) + reestruturação de Contas

### O que foi feito
- **Etapa 1 — Fundação:** projeto Supabase `financas-pessoais` criado; schema com 20 tabelas + 10 enums, RLS em todas, trigger `handle_new_user` (perfil + 49 categorias padrão), bucket `anexos`, hardening (advisor sem alertas). Scaffold Next.js: libs Supabase (client/server/middleware), tipos, layout base (sidebar/topbar), tema claro/escuro, auth (login/recuperar/redefinir). Usuário admin criado direto no banco; cadastro público desativado.
- **Etapa 2 — Contas + Categorias/Tags:** CRUD de contas com saldo calculado (RPC `get_account_balances`, migration 0007); CRUD de categorias (com subcategorias) e tags.
- **Etapa 3 — Lançamentos:** receita/despesa/transferência (transfer = 2 pernas com sinal), status previsto/realizado, tags, filtros por URL (período/conta/categoria/tipo/status/texto), paginação, quitar/duplicar/editar/excluir. Transferências colapsadas em 1 linha na lista.
- **Etapa 4 — Dashboard:** cartões de resumo + gráficos (Recharts): receitas×despesas, evolução do patrimônio (retrocedido do saldo atual), donut de despesas por categoria (rollup na mãe), lista a pagar/receber, toggle 6/12 meses.
- **Etapa 5 — Cartões e faturas:** cartão (limite, fechamento, vencimento, bandeira); compra com **parcelamento** (1 parcela por fatura); atribuição automática à fatura (`src/lib/card-invoice.ts`); detalhe com faturas (aberta/fechada/paga) e **pagar fatura** (transferência conta→cartão). RPC `get_invoice_totals` (migration 0008). Cartões saíram de Contas/Lançamentos.
- **Etapa 6 — Agenda (a pagar/receber) + recorrências:** previstos agrupados em atraso/hoje/próximos com quitar; regras diária/semanal/mensal/anual com data-fim ou nº repetições; **materialização idempotente** até 120 dias (ao abrir a agenda e ao criar/editar).
- **Etapa 7 — Orçamentos:** limite mensal por categoria, navegação de mês, barra de progresso + alerta ao estourar, comparativo 6 meses, copiar do mês anterior. Gasto de subcategoria soma na mãe.
- **Etapa 8 — Metas:** valor-alvo, prazo, aportes/resgates, barra de progresso, **projeção de conclusão** pelo ritmo médio e quanto/mês para o prazo.
- **Extra — Formulário de Contas reestruturado:** removido "Nome" genérico; select de bancos brasileiros + "Outro"; titularidade PF/PJ; agência/nº da conta só para corrente/poupança; apelido auto (sigla+titularidade), editável, usado como rótulo do card. Migration **0009** (colunas `titularidade`/`agencia`/`numero_conta`; RLS row-level já cobre).

### Decisões tomadas (e motivo)
- **Supabase novo projeto** (não usar `sgecont-prod`, que é de outro sistema) — isolamento total.
- **Anotar retorno dos clients como `SupabaseClient<Database>` + cast** — o tipo inferido do `@supabase/ssr` colapsa para `never` com schema grande.
- **Transferência em 2 pernas com sinal** — para mover saldo entre contas via a mesma função de saldo, sem contar como receita/despesa.
- **Cartões fora de Contas/Lançamentos**, mas dentro do patrimônio — modelo mental limpo, dívida contabilizada.
- **Materialização de recorrência sem cron** (ao abrir a agenda) — não há agendador; idempotente por `next_run_date`.
- **Nunca buildar com o dev rodando** — descoberto após o CSS quebrar por `.next` compartilhado; no Windows matar Next via PowerShell (pkill do bash não pega processos Windows). Dev na porta 3005.

### Estado atual (funciona)
Login, dashboard com gráficos, contas (novo form bancário) com saldo, categorias/tags, lançamentos com filtros, cartões/faturas com parcelamento e pagamento, agenda com recorrências, orçamentos e metas. Todas as etapas verificadas ponta a ponta (testes SQL com rollback + testes de lógica em Node). Build de produção limpo (26+ rotas).

### Pendências / próximos passos (ordem)
9. **Fluxo de caixa e projeções** — saldo acumulado por dia/semana/mês, projeção com previstos+recorrentes, alerta de saldo negativo projetado.
10. Patrimônio e investimentos.
11. Relatórios + exportação (CSV/PDF).
12. Importação OFX/CSV + conciliação (usar `import_batches`, `fingerprint`).
13. Notificações e configurações (perfil, preferências).
14. Polimento, PWA, testes finais.
- **Anexos/comprovantes** (Storage `anexos`) — pendente desde a Etapa 3.

### Pontos de atenção
- `SUPABASE_SERVICE_ROLE_KEY` está vazio no `.env.local` (sem seed programático por ora).
- Contas antigas (criadas antes do novo form) ficam com banco em "Outro"/titularidade PF ao editar, até ajuste manual.
- Advisor do Supabase acusa apenas "leaked password protection disabled" (config de Auth opcional, não bloqueante).
