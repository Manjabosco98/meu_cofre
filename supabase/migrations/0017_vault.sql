-- Cofre de acessos (gerenciador de senhas simplificado) dentro de Configurações.
-- SEGURANÇA: campos sensíveis (senha, token, api key, observações) são cifrados no CLIENTE
-- (Web Crypto: PBKDF2-SHA256 -> AES-GCM 256) e chegam aqui apenas como base64. O banco NUNCA
-- guarda esses valores em texto puro, nem a senha-mestra (só salt/params + um verifier cifrado).
-- RLS em todas as tabelas: user_id = (select auth.uid()) (forma performática, ver CLAUDE.md).

create type vault_item_type as enum (
  'email','platform','bank','card','api','system','server','social','subscription','other'
);
create type vault_item_status as enum ('active','inactive','expired','revoked');
create type vault_audit_action as enum (
  'created','updated','viewed_secret','copied_secret','deleted','master_password_changed'
);

-- Parâmetros do cofre por usuário (1 linha por usuário). Sem hash da senha-mestra:
-- 'verifier' = AES-GCM de uma constante canário; o cliente decifra e compara para validar a senha.
create table public.vault_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  salt text not null,
  kdf text not null default 'PBKDF2-SHA256',
  iterations int not null,
  verifier text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type vault_item_type not null default 'other',
  url text,
  username text,
  -- Somente base64 cifrado (nunca texto puro):
  encrypted_password text,
  encrypted_notes text,
  encrypted_token text,
  encrypted_api_key text,
  category text,
  status vault_item_status not null default 'active',
  has_2fa boolean not null default false,
  recovery_email text,
  recovery_phone text,
  expires_at date,
  favorite boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_items_user_idx on public.vault_items(user_id);

create table public.vault_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vault_item_id uuid references public.vault_items(id) on delete set null,
  action vault_audit_action not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index vault_audit_user_idx on public.vault_audit_logs(user_id, created_at desc);

-- RLS: cada usuário só acessa os próprios registros.
do $$
declare t text;
begin
  foreach t in array array['vault_settings','vault_items','vault_audit_logs'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy own_select on public.%I for select using (user_id = (select auth.uid()));', t);
    execute format('create policy own_insert on public.%I for insert with check (user_id = (select auth.uid()));', t);
    execute format('create policy own_update on public.%I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));', t);
    execute format('create policy own_delete on public.%I for delete using (user_id = (select auth.uid()));', t);
  end loop;
end $$;
