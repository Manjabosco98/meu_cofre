-- Otimização de RLS: envolve auth.uid() em (select auth.uid()) em todas as policies.
-- Assim o Postgres avalia o uid uma vez (initPlan) em vez de por linha — ganho em
-- tabelas grandes. Sem efeito de segurança (mesma expressão). Idempotência: as policies
-- atuais usam auth.uid() "cru"; esta migração roda uma vez.
do $$
declare
  r record;
  new_qual text;
  new_check text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      and coalesce(qual, '') not like '%select auth.uid()%'
      and coalesce(with_check, '') not like '%select auth.uid()%'
  loop
    new_qual := replace(coalesce(r.qual, ''), 'auth.uid()', '(select auth.uid())');
    new_check := replace(coalesce(r.with_check, ''), 'auth.uid()', '(select auth.uid())');
    if r.qual is not null and r.with_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, new_qual, new_check);
    elsif r.qual is not null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, new_qual);
    elsif r.with_check is not null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, new_check);
    end if;
  end loop;
end $$;
