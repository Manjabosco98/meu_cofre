-- Previsto x Realizado nos lançamentos.
-- valor_previsto = valor esperado (o "Valor" do formulário).
-- valor_realizado = valor efetivo que entrou/saiu (só quando cleared/realizado).
-- data_realizacao = quando de fato foi realizado.
-- Invariante mantido por trigger: amount_cents = (cleared ? valor_realizado : valor_previsto).
-- Assim balanço/relatórios/patrimônio (que filtram status='cleared' e leem amount_cents)
-- contam APENAS o realizado, sem alterar nenhuma outra query. Chamadores legados
-- (cartões/importação) continuam inserindo só amount_cents+status; o trigger preenche o resto.

alter table public.transactions
  add column if not exists valor_previsto bigint,
  add column if not exists valor_realizado bigint,
  add column if not exists data_realizacao timestamptz;

-- Backfill: previsto = valor atual; realizados recebem realizado = valor e data = date.
update public.transactions set valor_previsto = amount_cents where valor_previsto is null;
update public.transactions
  set valor_realizado = amount_cents,
      data_realizacao = coalesce(data_realizacao, date)
  where status = 'cleared' and valor_realizado is null;

alter table public.transactions
  alter column valor_previsto set not null;

-- Trigger que mantém o invariante amount_cents ⇔ previsto/realizado.
create or replace function public.sync_transaction_amounts()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Chamadores legados só informam amount_cents: deriva o previsto.
  if new.valor_previsto is null then
    new.valor_previsto := new.amount_cents;
  end if;

  if new.status = 'cleared' then
    -- Realizado sem valor informado assume o previsto (marcação rápida).
    if new.valor_realizado is null then
      new.valor_realizado := new.valor_previsto;
    end if;
    if new.data_realizacao is null then
      new.data_realizacao := new.date;
    end if;
    new.amount_cents := new.valor_realizado;
  else
    -- Previsto (pending) não tem realizado; alimenta apenas a projeção.
    new.valor_realizado := null;
    new.data_realizacao := null;
    new.amount_cents := new.valor_previsto;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_transaction_amounts on public.transactions;
create trigger trg_sync_transaction_amounts
  before insert or update on public.transactions
  for each row execute function public.sync_transaction_amounts();
