-- Total de cada fatura = soma dos lançamentos com aquele invoice_id.
create or replace function public.get_invoice_totals()
returns table (invoice_id uuid, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.invoice_id, coalesce(sum(t.amount_cents), 0)::bigint
  from public.transactions t
  where t.user_id = auth.uid() and t.invoice_id is not null
  group by t.invoice_id;
$$;
