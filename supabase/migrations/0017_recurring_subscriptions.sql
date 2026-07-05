-- 0017_recurring_subscriptions.sql (idempotente)
-- Assinaturas recorrentes em cartoes de credito.

create table if not exists public.recurring_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  description text not null,
  amount_cents bigint not null,
  category_id uuid references public.categories(id) on delete set null,
  frequency recurrence_frequency not null default 'monthly',
  interval int not null default 1,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  next_billing_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_subscriptions_user_idx on public.recurring_subscriptions(user_id);
create index if not exists recurring_subscriptions_card_idx on public.recurring_subscriptions(credit_card_id);

-- RLS
alter table public.recurring_subscriptions enable row level security;

do $$ begin
  create policy own_select on public.recurring_subscriptions for select using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_insert on public.recurring_subscriptions for insert with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_update on public.recurring_subscriptions for update using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_delete on public.recurring_subscriptions for delete using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

-- FK em transactions
do $$ begin
  alter table public.transactions
    add column if not exists recurring_subscription_id uuid
    references public.recurring_subscriptions(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists transactions_subscription_idx on public.transactions(recurring_subscription_id);
