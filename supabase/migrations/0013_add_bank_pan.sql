-- Banco PAN adicionado ao catálogo (lib/banks.ts). Converte o institution legado
-- "PAN"/"Banco PAN" para o slug estável "pan" (conta e cartão existentes).
update public.accounts
set institution = 'pan'
where institution in ('PAN', 'Banco PAN');
