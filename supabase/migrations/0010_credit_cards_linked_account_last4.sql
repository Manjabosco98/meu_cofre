-- Etapa 5 (ajuste): cartão ganha conta de pagamento vinculada e "final do cartão".
-- linked_account_id: conta corrente/poupança usada como origem padrão ao pagar a fatura.
--   ON DELETE SET NULL para não impedir a exclusão da conta vinculada.
-- last4: apenas os 4 últimos dígitos (nunca o número completo), texto.
-- Obs.: o "limite total" já é credit_cards.limit_cents; o "limite disponível" é calculado.

alter table public.credit_cards
  add column if not exists linked_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists last4 text;

alter table public.credit_cards
  drop constraint if exists credit_cards_last4_chk;
alter table public.credit_cards
  add constraint credit_cards_last4_chk check (last4 is null or last4 ~ '^[0-9]{4}$');

create index if not exists credit_cards_linked_account_id_idx
  on public.credit_cards (linked_account_id);

-- RLS já existente em credit_cards (own_select/insert/update/delete por user_id) cobre as novas colunas.
-- A integridade referencial da conta vinculada é garantida pela FK acima.
