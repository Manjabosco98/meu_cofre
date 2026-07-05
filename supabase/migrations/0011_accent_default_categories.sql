-- Acentuação pt-BR das categorias padrão (lote gerado sem acentos).
-- 1) Recria seed_default_categories com nomes acentuados (provisionamentos futuros).
-- 2) Corrige as linhas já existentes.

create or replace function public.seed_default_categories(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with parents as (
    insert into public.categories (user_id, name, kind, color, icon, is_default)
    select uid, v.name, v.kind::category_kind, v.color, v.icon, true
    from (values
      ('Moradia','expense','#f97316','home'),
      ('Alimentação','expense','#ef4444','utensils'),
      ('Transporte','expense','#3b82f6','car'),
      ('Saúde','expense','#14b8a6','heart-pulse'),
      ('Educação','expense','#8b5cf6','graduation-cap'),
      ('Lazer','expense','#ec4899','gamepad-2'),
      ('Compras','expense','#a855f7','shopping-bag'),
      ('Serviços','expense','#64748b','wrench'),
      ('Impostos e taxas','expense','#78716c','landmark'),
      ('Outros','expense','#94a3b8','circle-dashed'),
      ('Salário','income','#22c55e','briefcase'),
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
    ('Moradia','Aluguel'),('Moradia','Condomínio'),('Moradia','Água'),
    ('Moradia','Luz'),('Moradia','Internet'),('Moradia','Gás'),
    ('Alimentação','Supermercado'),('Alimentação','Restaurante'),
    ('Alimentação','Delivery'),('Alimentação','Padaria'),
    ('Transporte','Combustível'),('Transporte','Transporte público'),
    ('Transporte','App/Táxi'),('Transporte','Manutenção'),
    ('Saúde','Plano de saúde'),('Saúde','Farmácia'),
    ('Saúde','Consultas'),('Saúde','Academia'),
    ('Educação','Cursos'),('Educação','Livros'),('Educação','Mensalidade'),
    ('Lazer','Streaming'),('Lazer','Cinema'),('Lazer','Viagens'),('Lazer','Hobbies'),
    ('Compras','Vestuário'),('Compras','Eletrônicos'),('Compras','Casa'),
    ('Serviços','Assinaturas'),('Serviços','Telefone'),
    ('Salário','Salário'),('Salário','13º'),('Salário','Férias')
  ) as c(parent_name, child)
  join parents p on p.name = c.parent_name;
end;
$$;

-- Corrige linhas já criadas (todos os usuários; single-user).
update public.categories c
set name = m.acc
from (values
  ('Alimentacao','Alimentação'),
  ('Saude','Saúde'),
  ('Educacao','Educação'),
  ('Servicos','Serviços'),
  ('Salario','Salário'),
  ('Condominio','Condomínio'),
  ('Agua','Água'),
  ('Gas','Gás'),
  ('Combustivel','Combustível'),
  ('Transporte publico','Transporte público'),
  ('App/Taxi','App/Táxi'),
  ('Manutencao','Manutenção'),
  ('Plano de saude','Plano de saúde'),
  ('Farmacia','Farmácia'),
  ('Vestuario','Vestuário'),
  ('Eletronicos','Eletrônicos'),
  ('13o','13º'),
  ('Ferias','Férias')
) as m(unacc, acc)
where c.name = m.unacc;
