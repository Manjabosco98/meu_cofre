create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger trg_transactions_updated before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger trg_investments_updated before update on public.investments
  for each row execute function public.set_updated_at();

create or replace function public.seed_default_categories(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with parents as (
    insert into public.categories (user_id, name, kind, color, icon, is_default)
    select uid, v.name, v.kind::category_kind, v.color, v.icon, true
    from (values
      ('Moradia','expense','#f97316','home'),
      ('Alimentacao','expense','#ef4444','utensils'),
      ('Transporte','expense','#3b82f6','car'),
      ('Saude','expense','#14b8a6','heart-pulse'),
      ('Educacao','expense','#8b5cf6','graduation-cap'),
      ('Lazer','expense','#ec4899','gamepad-2'),
      ('Compras','expense','#a855f7','shopping-bag'),
      ('Servicos','expense','#64748b','wrench'),
      ('Impostos e taxas','expense','#78716c','landmark'),
      ('Outros','expense','#94a3b8','circle-dashed'),
      ('Salario','income','#22c55e','briefcase'),
      ('Freelance','income','#10b981','laptop'),
      ('Investimentos','income','#0ea5e9','trending-up'),
      ('Reembolsos','income','#84cc16','rotate-ccw'),
      ('Presentes','income','#eab308','gift'),
      ('Outras receitas','income','#4ade80','plus-circle')
    ) as v(name, kind, color, icon)
    returning id, name, kind, color, icon
  )
  insert into public.categories (user_id, name, kind, parent_id, color, icon, is_default)
  select uid, c.child, p.kind, p.id, p.color, p.icon, true
  from (values
    ('Moradia','Aluguel'),('Moradia','Condominio'),('Moradia','Agua'),
    ('Moradia','Luz'),('Moradia','Internet'),('Moradia','Gas'),
    ('Alimentacao','Supermercado'),('Alimentacao','Restaurante'),
    ('Alimentacao','Delivery'),('Alimentacao','Padaria'),
    ('Transporte','Combustivel'),('Transporte','Transporte publico'),
    ('Transporte','App/Taxi'),('Transporte','Manutencao'),
    ('Saude','Plano de saude'),('Saude','Farmacia'),
    ('Saude','Consultas'),('Saude','Academia'),
    ('Educacao','Cursos'),('Educacao','Livros'),('Educacao','Mensalidade'),
    ('Lazer','Streaming'),('Lazer','Cinema'),('Lazer','Viagens'),('Lazer','Hobbies'),
    ('Compras','Vestuario'),('Compras','Eletronicos'),('Compras','Casa'),
    ('Servicos','Assinaturas'),('Servicos','Telefone'),
    ('Salario','Salario'),('Salario','13o'),('Salario','Ferias')
  ) as c(parent_name, child)
  join parents p on p.name = c.parent_name;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
