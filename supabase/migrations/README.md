# Migrations

Estas migrations **já foram aplicadas** ao projeto Supabase `financas-pessoais`
(via conexão MCP). Ficam aqui versionadas para histórico e para recriar o banco
do zero, se necessário.

Ordem:

1. `0001_enums.sql` — tipos enumerados
2. `0002_core_tables.sql` — `profiles` + todas as tabelas do modelo + índices
3. `0003_triggers_and_defaults.sql` — `set_updated_at`, `seed_default_categories`, `handle_new_user`
4. `0004_rls_policies.sql` — RLS + policies (`user_id = auth.uid()`) em todas as tabelas
5. `0005_storage_anexos.sql` — bucket privado `anexos` + policies por usuário
6. `0006_security_hardening.sql` — `search_path` fixo e revogação de EXECUTE nas funções SECURITY DEFINER

## Recriar do zero (opcional, via Supabase CLI)

```bash
supabase link --project-ref jzgqkdfnkhsjiwkurekj
supabase db push
```

> O conteúdo completo de 0002–0006 está reproduzido abaixo do índice de cada
> arquivo. Os arquivos `0002`–`0006` acompanham este diretório.
