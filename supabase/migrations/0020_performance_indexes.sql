-- =============================================================================
-- 0020: Performance indexes e otimizações de query
-- =============================================================================
-- Objetivo: acelerar RPCs frequentes (get_account_balances, get_invoice_totals)
-- e cobrir FKs sem índice identificadas pelo advisor.

-- ---------------------------------------------------------------------------
-- 1. Covering index para get_account_balances()
--    A LEFT JOIN + SUM pode ser satisfeita inteiramente pelo índice (index-only scan).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS transactions_balance_cover
  ON transactions(user_id, status, account_id)
  INCLUDE (amount_cents, type);

-- ---------------------------------------------------------------------------
-- 2. Covering index parcial para get_invoice_totals()
--    Ignora linhas onde invoice_id IS NULL; index-only scan para o GROUP BY.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS transactions_invoice_totals_cover
  ON transactions(user_id, invoice_id)
  INCLUDE (amount_cents)
  WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. FK indexes faltantes (consistência + performance em JOIN/cascade)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS recurring_subscriptions_category_idx
  ON recurring_subscriptions(category_id);

CREATE INDEX IF NOT EXISTS vault_audit_logs_vault_item_idx
  ON vault_audit_logs(vault_item_id);

CREATE INDEX IF NOT EXISTS ofx_acctid_map_card_idx
  ON ofx_acctid_map(card_id);

-- ---------------------------------------------------------------------------
-- 4. Rewrite storage policies para usar (select auth.uid())::text
--    (consistente com todas as policies de public.*; o engine de storage avalia
--    separado mas o padrão evita divergência e melhora legibilidade).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop and recreate storage policies with (select auth.uid())::text pattern
  -- policy: allow_insert (authenticated users can upload to own folder)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_insert' AND schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY "allow_insert" ON storage.objects;
  END IF;
  CREATE POLICY "allow_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'anexos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

  -- policy: allow_select (authenticated users can read own files)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_select' AND schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY "allow_select" ON storage.objects;
  END IF;
  CREATE POLICY "allow_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'anexos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

  -- policy: allow_update (authenticated users can update own files)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_update' AND schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY "allow_update" ON storage.objects;
  END IF;
  CREATE POLICY "allow_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'anexos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

  -- policy: allow_delete (authenticated users can delete own files)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_delete' AND schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY "allow_delete" ON storage.objects;
  END IF;
  CREATE POLICY "allow_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'anexos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
END
$$;
