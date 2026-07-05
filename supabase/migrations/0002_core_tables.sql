-- Perfil do usuario (1:1 com auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  theme text not null default 'system',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type account_type not null,
  institution text,
  initial_balance_cents bigint not null default 0,
  color text not null default '#6366f1',
  icon text not null default 'wallet',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts(user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  parent_id uuid references public.categories(id) on delete set null,
  color text not null default '#64748b',
  icon text not null default 'tag',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index categories_user_idx on public.categories(user_id);
create index categories_parent_idx on public.categories(parent_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#0ea5e9',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  limit_cents bigint not null default 0,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  brand text,
  created_at timestamptz not null default now()
);
create index credit_cards_user_idx on public.credit_cards(user_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status invoice_status not null default 'open',
  paid_transaction_id uuid,
  created_at timestamptz not null default now()
);
create index invoices_user_idx on public.invoices(user_id);
create index invoices_card_idx on public.invoices(credit_card_id);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  description text not null,
  amount_cents bigint not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  frequency recurrence_frequency not null,
  interval int not null default 1,
  start_date date not null,
  end_date date,
  occurrences int,
  next_run_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_user_idx on public.recurring_rules(user_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source import_source not null,
  file_name text not null,
  imported_count int not null default 0,
  duplicate_count int not null default 0,
  created_at timestamptz not null default now()
);
create index import_batches_user_idx on public.import_batches(user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  amount_cents bigint not null,
  date timestamptz not null,
  description text not null,
  notes text,
  status transaction_status not null default 'cleared',
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  transfer_group_id uuid,
  invoice_id uuid references public.invoices(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  installment_group_id uuid,
  installment_no int,
  installment_total int,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  external_id text,
  fingerprint text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index transactions_account_idx on public.transactions(account_id);
create index transactions_category_idx on public.transactions(category_id);
create index transactions_invoice_idx on public.transactions(invoice_id);
create index transactions_transfer_idx on public.transactions(transfer_group_id);

alter table public.invoices
  add constraint invoices_paid_tx_fk
  foreign key (paid_transaction_id) references public.transactions(id) on delete set null;

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);
create index attachments_tx_idx on public.attachments(transaction_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  limit_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);
create index budgets_user_idx on public.budgets(user_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_cents bigint not null,
  deadline date,
  status goal_status not null default 'active',
  color text not null default '#22c55e',
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals(user_id);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount_cents bigint not null,
  date timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
create index goal_contrib_goal_idx on public.goal_contributions(goal_id);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  current_value_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index investments_user_idx on public.investments(user_id);

create table public.investment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  type investment_entry_type not null,
  amount_cents bigint not null,
  date timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
create index investment_entries_inv_idx on public.investment_entries(investment_id);

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  assets_cents bigint not null,
  liabilities_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index net_worth_user_idx on public.net_worth_snapshots(user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at);
