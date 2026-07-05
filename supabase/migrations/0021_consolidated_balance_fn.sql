-- =============================================================================
-- 0021: RPC get_consolidated_balance() — saldo consolidado correto
-- =============================================================================
-- Retorna o saldo consolidado (contas bancárias − reservado em metas),
-- excluindo cartões de crédito (passivos).

CREATE OR REPLACE FUNCTION public.get_consolidated_balance()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Soma dos saldos das contas bancárias (exclui credit_card)
  -- menos o valor reservado em metas vinculadas
  WITH account_balances AS (
    SELECT a.id, a.type,
      a.initial_balance_cents + coalesce(sum(
        CASE t.type
          WHEN 'income' THEN t.amount_cents
          WHEN 'expense' THEN -t.amount_cents
          ELSE t.amount_cents
        END
      ) FILTER (WHERE t.status = 'cleared'), 0)::bigint AS balance_cents
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.user_id = (select auth.uid()) AND a.archived = false AND a.type != 'credit_card'
    GROUP BY a.id, a.type, a.initial_balance_cents
  ),
  goal_reserved AS (
    SELECT g.account_id, coalesce(sum(gc.amount_cents), 0)::bigint AS reserved_cents
    FROM goals g
    INNER JOIN goal_contributions gc ON gc.goal_id = g.id
    WHERE g.user_id = (select auth.uid()) AND g.account_id IS NOT NULL AND g.status != 'archived'
    GROUP BY g.account_id
  )
  SELECT coalesce(sum(ab.balance_cents - coalesce(gr.reserved_cents, 0)), 0)::bigint
  FROM account_balances ab
  LEFT JOIN goal_reserved gr ON gr.account_id = ab.id;
$$;
