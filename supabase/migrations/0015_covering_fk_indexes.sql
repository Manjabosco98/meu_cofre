-- Índices de cobertura para FKs sinalizadas pelo advisor (Etapa 3.3). Baratos e
-- ajudam em joins/checagens de FK e em deletes (verificação de referência) em escala.
create index if not exists budgets_category_idx on public.budgets (category_id);
create index if not exists goal_contributions_user_idx on public.goal_contributions (user_id);
create index if not exists investment_entries_user_idx on public.investment_entries (user_id);
create index if not exists invoices_paid_tx_idx on public.invoices (paid_transaction_id);
create index if not exists recurring_rules_account_idx on public.recurring_rules (account_id);
create index if not exists recurring_rules_category_idx on public.recurring_rules (category_id);
create index if not exists transaction_tags_tag_idx on public.transaction_tags (tag_id);
create index if not exists transactions_import_batch_idx on public.transactions (import_batch_id);
create index if not exists transactions_recurring_rule_idx on public.transactions (recurring_rule_id);
create index if not exists attachments_user_idx on public.attachments (user_id);
