-- 0019_ofx_acctid_map.sql
-- Mapeamento ACCTID (UUID do OFX) → cartão de crédito.
-- Salva no primeiro import para sugerir automaticamente nos próximos.

create table public.ofx_acctid_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  acctid text not null,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, acctid)
);

alter table public.ofx_acctid_map enable row level security;

create policy "Users can manage their own OFX mappings"
  on public.ofx_acctid_map for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index ofx_acctid_map_user_idx on public.ofx_acctid_map(user_id);
