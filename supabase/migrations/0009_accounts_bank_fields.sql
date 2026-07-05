-- Novos campos de conta: titularidade (PF/PJ), agência e número da conta.
alter table public.accounts
  add column titularidade text check (titularidade in ('PF','PJ')),
  add column agencia text,
  add column numero_conta text;

-- RLS: as policies de accounts são row-level (user_id = auth.uid()) e cobrem
-- automaticamente as novas colunas — nenhuma alteração de policy é necessária.
