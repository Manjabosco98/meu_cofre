do $$
declare t text;
begin
  foreach t in array array[
    'accounts','categories','tags','credit_cards','invoices','recurring_rules',
    'import_batches','transactions','attachments','budgets','goals',
    'goal_contributions','investments','investment_entries',
    'net_worth_snapshots','notifications'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy own_select on public.%I for select using (user_id = auth.uid());', t);
    execute format('create policy own_insert on public.%I for insert with check (user_id = auth.uid());', t);
    execute format('create policy own_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
    execute format('create policy own_delete on public.%I for delete using (user_id = auth.uid());', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy own_select on public.profiles for select using (id = auth.uid());
create policy own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.transaction_tags enable row level security;
create policy own_select on public.transaction_tags for select
  using (exists (select 1 from public.transactions x where x.id = transaction_id and x.user_id = auth.uid()));
create policy own_insert on public.transaction_tags for insert
  with check (exists (select 1 from public.transactions x where x.id = transaction_id and x.user_id = auth.uid()));
create policy own_delete on public.transaction_tags for delete
  using (exists (select 1 from public.transactions x where x.id = transaction_id and x.user_id = auth.uid()));
