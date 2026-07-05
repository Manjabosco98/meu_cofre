-- Saldo atual por conta = saldo inicial + soma dos lançamentos realizados (cleared).
-- Convenção de sinal: income (+), expense (-), transfer (a perna já vem com sinal — Etapa 3).
-- SECURITY INVOKER: respeita RLS; auth.uid() limita ao próprio usuário.
create or replace function public.get_account_balances()
returns table (account_id uuid, balance_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    a.initial_balance_cents + coalesce(sum(
      case t.type
        when 'income' then t.amount_cents
        when 'expense' then -t.amount_cents
        else t.amount_cents
      end
    ) filter (where t.status = 'cleared'), 0)::bigint
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  where a.user_id = auth.uid()
  group by a.id, a.initial_balance_cents;
$$;
