-- ============================================================
-- MULTI-EMPRESA — Cole no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona coluna loja_id nas tabelas principais
alter table usuarios  add column if not exists lojas text[] default '{}';
alter table registros add column if not exists empresa text default 'Barba Lenhador';
alter table produtos  add column if not exists empresa text default 'Barba Lenhador';

-- 2. Atualiza produtos existentes para Barba Lenhador
update produtos set empresa = 'Barba Lenhador' where empresa is null;

-- 3. Atualiza registros existentes para Barba Lenhador  
update registros set empresa = loja where empresa is null;

-- 4. Atualiza admin para ter acesso a todas as lojas
update usuarios set lojas = '{"Barba Lenhador","Perito da Barba","Barba Completa"}' where role = 'admin';

-- 5. Atualiza atendentes existentes para Barba Lenhador por padrão
update usuarios set lojas = '{"Barba Lenhador"}' where role = 'atendente' and (lojas is null or lojas = '{}');
