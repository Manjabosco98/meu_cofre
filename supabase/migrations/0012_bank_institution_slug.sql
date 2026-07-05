-- Migra accounts.institution do valor legado (nome ou sigla do banco) para o SLUG
-- estável usado por lib/banks.ts (vínculo com a logo). Valores não reconhecidos
-- (ex.: "PAN", bancos livres) ficam como estão (texto livre → ícone de fallback).
-- Idempotente: um institution já em slug casa com m.slug e permanece igual.

update public.accounts a
set institution = m.slug
from (values
  ('nubank','Nubank','NU'),
  ('itau','Itaú','ITAÚ'),
  ('bradesco','Bradesco','BRAD'),
  ('bb','Banco do Brasil','BB'),
  ('caixa','Caixa Econômica','CEF'),
  ('santander','Santander','SANT'),
  ('inter','Banco Inter','INTER'),
  ('c6','C6 Bank','C6'),
  ('btg','BTG Pactual','BTG'),
  ('sicoob','Sicoob','SICOOB'),
  ('sicredi','Sicredi','SICREDI'),
  ('picpay','PicPay','PICPAY'),
  ('mercadopago','Mercado Pago','MP'),
  ('original','Banco Original','ORIG'),
  ('safra','Banco Safra','SAFRA'),
  ('xp','XP Investimentos','XP'),
  ('neon','Neon','NEON'),
  ('banrisul','Banrisul','BANRI')
) as m(slug, nome, sigla)
where a.institution is not null
  and (a.institution = m.slug or a.institution = m.nome or a.institution = m.sigla);
