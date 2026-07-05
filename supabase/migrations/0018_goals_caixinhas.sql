-- 0018_goals_caixinhas.sql (idempotente)
-- Evolucao das Metas para Caixinhas (Nubank-style).

-- Novos campos na tabela goals
do $$ begin
  alter table public.goals add column recurring_contribution_cents bigint;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.goals add column contribution_frequency text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.goals add column start_date date;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.goals add column estimated_completion_date date;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.goals add column account_id uuid references public.accounts(id) on delete set null;
exception when duplicate_column then null; end $$;

-- Expandir enum goal_status com 'paused'
do $$ begin
  alter type goal_status add value if not exists 'paused';
exception when duplicate_object then null; end $$;

-- Campo type em goal_contributions
do $$ begin
  alter table public.goal_contributions
    add column type text not null default 'contribution'
    check (type in ('contribution','withdrawal','adjustment','completed','paused','resumed'));
exception when duplicate_column then null; end $$;

-- Índices
create index if not exists goals_account_idx on public.goals(account_id);
