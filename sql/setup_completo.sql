-- ============================================================
-- CONTROLE REENVIOS — Setup Completo v24
-- Cole TUDO isso no SQL Editor do Supabase e execute de uma vez
-- ============================================================

-- ── 1. TABELAS ──

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha_hash text not null,
  role text not null default 'atendente',
  ativo boolean not null default true,
  lojas text[] default '{"Barba Lenhador"}',
  criado_em timestamptz default now()
);

create table if not exists registros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  loja text not null,
  data_pedido date,
  motivo text,
  fretes_estorno text,
  numero_pedido text,
  whatsapp text,
  novo_codigo_rastreio text,
  data_reenvio date,
  usuario_id uuid references usuarios(id),
  usuario_nome text,
  empresa text default 'Barba Lenhador',
  criado_em timestamptz default now()
);

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  link_yampi text not null,
  categoria text not null,
  ativo boolean default true,
  empresa text default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

create table if not exists historico_links (
  id uuid primary key default gen_random_uuid(),
  nome_produto text,
  categoria text,
  url text,
  campaign text,
  source text,
  usuario_id uuid references usuarios(id),
  usuario_nome text,
  criado_em timestamptz default now()
);

create table if not exists link_stats (
  id uuid primary key default gen_random_uuid(),
  nome_produto text unique not null,
  contagem integer default 1,
  atualizado_em timestamptz default now()
);

create table if not exists solicitacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha_hash text not null,
  status text not null default 'pendente',
  criado_em timestamptz default now()
);

-- ── 2. RLS ──

alter table usuarios        enable row level security;
alter table registros       enable row level security;
alter table produtos        enable row level security;
alter table historico_links enable row level security;
alter table link_stats      enable row level security;
alter table solicitacoes    enable row level security;

-- ── 3. POLÍTICAS ──

drop policy if exists "allow_all_usuarios"     on usuarios;
drop policy if exists "allow_all_registros"    on registros;
drop policy if exists "allow_all_produtos"     on produtos;
drop policy if exists "allow_all_historico"    on historico_links;
drop policy if exists "allow_all_stats"        on link_stats;
drop policy if exists "allow_all_solicitacoes" on solicitacoes;

create policy "allow_all_usuarios"     on usuarios        for all using (true) with check (true);
create policy "allow_all_registros"    on registros       for all using (true) with check (true);
create policy "allow_all_produtos"     on produtos        for all using (true) with check (true);
create policy "allow_all_historico"    on historico_links for all using (true) with check (true);
create policy "allow_all_stats"        on link_stats      for all using (true) with check (true);
create policy "allow_all_solicitacoes" on solicitacoes    for all using (true) with check (true);

-- ── 4. COLUNAS MULTI-EMPRESA (se não existirem) ──

alter table usuarios  add column if not exists lojas    text[] default '{"Barba Lenhador"}';
alter table registros add column if not exists empresa  text   default 'Barba Lenhador';
alter table produtos  add column if not exists empresa  text   default 'Barba Lenhador';

-- ── 5. ADMIN PADRÃO ──
-- Senha: Admin1234

insert into usuarios (nome, email, senha_hash, role, ativo, lojas)
values (
  'Administrador',
  'admin@barbalenhador.com.br',
  '60fe74406e7f353ed979f350f2fbb6a2e8690a5fa7d1b0c32983d1d8b3f95f67',
  'admin',
  true,
  '{"Barba Lenhador","Perito da Barba","Barba Completa"}'
) on conflict (email) do update
  set role  = 'admin',
      ativo = true,
      lojas = '{"Barba Lenhador","Perito da Barba","Barba Completa"}';

-- ── 6. ATUALIZA USUÁRIOS EXISTENTES ──

update usuarios
set lojas = '{"Barba Lenhador","Perito da Barba","Barba Completa"}'
where role = 'admin' and (lojas is null or lojas = '{}');

update usuarios
set lojas = '{"Barba Lenhador"}'
where role = 'atendente' and (lojas is null or lojas = '{}');

update registros set empresa = 'Barba Lenhador' where empresa is null;
update produtos  set empresa = 'Barba Lenhador' where empresa is null;

-- ── 7. PRODUTOS DA BARBA LENHADOR ──

insert into produtos (nome, link_yampi, categoria, ativo, empresa) values
('1 Ativador + 1 Multivitaminico','https://seguro.loja-barbalenhador.com.br/pay/GK3PYAKHRQ','Kit',true,'Barba Lenhador'),
('1 Ativador de crescimento','https://seguro.loja-barbalenhador.com.br/pay/D8JNCVTSPQ','Ativador',true,'Barba Lenhador'),
('1 C/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/BUIGVACYA','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/ Kirkland + 1 Multivitaminico','https://seguro.loja-barbalenhador.com.br/pay/XXXZFPUXJG','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/ Kirkland + 1 Pente de Madeira + 1 Máquina de Acabamento + 1 Chapinha','https://seguro.loja-barbalenhador.com.br/pay/GXZK7WNNWA','Kit',true,'Barba Lenhador'),
('1 C/ Kirkland + 3 Multivitaminicos + Derma Roller','https://seguro.loja-barbalenhador.com.br/pay/ANU0WHARNG','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/ Kirkland + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/GYQJFXUNWA','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/ Kirkland + Dermaroller 394','https://seguro.loja-barbalenhador.com.br/pay/NBADAGFH0G','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/ Kirkland + Pente de Madeira','https://seguro.loja-barbalenhador.com.br/pay/O5OIQJYA','Kirkland Caixa',true,'Barba Lenhador'),
('1 C/Kirkland + Hidratante','https://seguro.loja-barbalenhador.com.br/pay/6Z3GYVCFBW','Kirkland Caixa',true,'Barba Lenhador'),
('1 Caixa de Minoxidil + 1 Multivitaminico + 1 Ativador','https://seguro.loja-barbalenhador.com.br/pay/GGVREWNZ6Q','Minoxidil Caixa',true,'Barba Lenhador'),
('1 Caixa de Minoxidil + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/JZJ2GSH7PQ','Minoxidil Caixa',true,'Barba Lenhador'),
('1 Caixa Minoxidil + 1 Multivitamínico + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/VJ7SLWJ0A','Minoxidil Caixa',true,'Barba Lenhador'),
('1 F/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/Q2IOCENMWQ','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Hidratante Facial','https://seguro.loja-barbalenhador.com.br/pay/OBWFBVMOGW','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Hidratante Facial + 1 Derma Roller','https://seguro.loja-barbalenhador.com.br/pay/CPKEYQVVOQ','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Hidratante Facial + 1 Esfoliante + 1 Multivitamínico','https://seguro.loja-barbalenhador.com.br/pay/DSK5QLTDBA','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Multivitaminico','https://seguro.loja-barbalenhador.com.br/pay/FWCUXRXDW','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Multivitaminico + Derma Roller','https://seguro.loja-barbalenhador.com.br/pay/XWMWITPG8G','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Pomada efeito seco','https://seguro.loja-barbalenhador.com.br/pay/HRYTRQGVVQ','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Pomada efeito seco + Derma Roller','https://seguro.loja-barbalenhador.com.br/pay/TWIOXQQIDA','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + 1 Pomada efeito úmido + Derma Roller','https://seguro.loja-barbalenhador.com.br/pay/QSKWKWTDTQ','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + Derma roller C/ Conta-gotas','https://seguro.loja-barbalenhador.com.br/pay/LSL8FYPDA','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland + Pomada efeito úmido','https://seguro.loja-barbalenhador.com.br/pay/VQMUY9SSMW','Kirkland Frasco',true,'Barba Lenhador'),
('1 F/ Kirkland s/ conta-gotas','https://seguro.loja-barbalenhador.com.br/pay/QG43WOJTIQ','Kirkland Frasco',true,'Barba Lenhador'),
('1 Frasco + Espuma Massageadora','https://seguro.loja-barbalenhador.com.br/pay/OOYAJRM6W','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco 86,90','https://seguro.loja-barbalenhador.com.br/pay/3MMEIXU08W','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco de Minoxidil + 1 Ativador de crescimento','https://seguro.loja-barbalenhador.com.br/pay/YM4TVBM7QA','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minox 109','https://seguro.loja-barbalenhador.com.br/pay/T5EGHLPHZG','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minoxidil + 1 Multivitamínico + 1 Pomada','https://seguro.loja-barbalenhador.com.br/pay/18BW6K6EA','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minoxidil + 1 Multivitaminico Ativador','https://seguro.loja-barbalenhador.com.br/pay/3EF9ROF1WA','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minoxidil + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/EYSZ7O0IQ','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minoxidil 89','https://seguro.loja-barbalenhador.com.br/pay/92SILHLQ2Q','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Frasco Minoxidil 94','https://seguro.loja-barbalenhador.com.br/pay/Y5GXDNXA','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Hidratante + 1 Espuma massageadora','https://seguro.loja-barbalenhador.com.br/pay/MTOHO4D0W','Skincare',true,'Barba Lenhador'),
('1 Kit lenhador + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/U1JKSAH3W','Kit',true,'Barba Lenhador'),
('1 Minoxidil + 1 Multivitamínico','https://seguro.loja-barbalenhador.com.br/pay/ASASTUZPAQ','Minoxidil Frasco',true,'Barba Lenhador'),
('1 Minoxidil Foligain exclusivo','https://seguro.loja-barbalenhador.com.br/pay/0TJS99UW','Foligain',true,'Barba Lenhador'),
('1 Multivitaminico','https://seguro.loja-barbalenhador.com.br/pay/ONO7XRBAPW','Multivitaminico',true,'Barba Lenhador'),
('1 Pomada efeito Seco','https://seguro.loja-barbalenhador.com.br/pay/IAXI2LALYW','Pomada',true,'Barba Lenhador'),
('1 Pomada Efeito Úmido','https://seguro.loja-barbalenhador.com.br/pay/QP0YMLY7Q','Pomada',true,'Barba Lenhador'),
('10 Frascos de minoxidil','https://seguro.loja-barbalenhador.com.br/pay/YP2NN9LAOW','Minoxidil Frasco',true,'Barba Lenhador'),
('15 Frascos Minoxidil','https://seguro.loja-barbalenhador.com.br/pay/XIYEYRR62G','Minoxidil Frasco',true,'Barba Lenhador'),
('2 Ativadores crescimento','https://seguro.loja-barbalenhador.com.br/pay/LFNNSDIAXQ','Ativador',true,'Barba Lenhador'),
('2 C/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/EJBU0F4SGW','Kirkland Caixa',true,'Barba Lenhador'),
('2 F/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/ACEZYT3ZOA','Kirkland Frasco',true,'Barba Lenhador'),
('2 F/ Kirkland + 2 Multivitaminico','https://seguro.loja-barbalenhador.com.br/pay/MI9I05ES3A','Kirkland Frasco',true,'Barba Lenhador'),
('2 F/ Kirkland + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/GDLNW8QYTG','Kirkland Frasco',true,'Barba Lenhador'),
('2 F/ Kirkland S/ Conta-gotas','https://seguro.loja-barbalenhador.com.br/pay/B6AKVN5YQ','Kirkland Frasco',true,'Barba Lenhador'),
('2 Frascos + Esfoliante','https://seguro.loja-barbalenhador.com.br/pay/8MXS0KJ0QA','Minoxidil Frasco',true,'Barba Lenhador'),
('2 Frascos de Minoxidil + 1 Multivitamínco + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/VZLKXNPP2W','Minoxidil Frasco',true,'Barba Lenhador'),
('2 Frascos Foligain','https://seguro.loja-barbalenhador.com.br/pay/QISBJ4JV3Q','Foligain',true,'Barba Lenhador'),
('2 Frascos Minoxidil + 2 Multivitamínico + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/FC1YFARFA','Minoxidil Frasco',true,'Barba Lenhador'),
('2 Frascos Minoxidil FG','https://seguro.loja-barbalenhador.com.br/pay/VAETQPK9W','Minoxidil Frasco',true,'Barba Lenhador'),
('2 Multivitamínico Ativador MAJOR','https://seguro.loja-barbalenhador.com.br/pay/90QEHAKQEW','Multivitaminico',true,'Barba Lenhador'),
('2 Pomadas efeito úmido','https://seguro.loja-barbalenhador.com.br/pay/II8ADF7PUQ','Pomada',true,'Barba Lenhador'),
('3 F/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/NLTGOGOQWA','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + 1 Multivitamínico','https://seguro.loja-barbalenhador.com.br/pay/2MKW1CVZLG','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + 1 Pomada Efeito Seco','https://seguro.loja-barbalenhador.com.br/pay/7D1ANKITA','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + 1 Pomada Efeito Úmido + 1 Derma roller','https://seguro.loja-barbalenhador.com.br/pay/SVBXMB9QG','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + 3 Multivitaminicos','https://seguro.loja-barbalenhador.com.br/pay/LZFEDZN4XG','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + 3 Multivitaminicos + 2 Hidratantes','https://seguro.loja-barbalenhador.com.br/pay/C4CLUHHEDW','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/VLPFDILRG','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland + Pente de madeiras','https://seguro.loja-barbalenhador.com.br/pay/JR2XZQTNRQ','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland 2 conta-gotas','https://seguro.loja-barbalenhador.com.br/pay/ADEFNAIRMA','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland 219 FG','https://seguro.loja-barbalenhador.com.br/pay/MEYZSMIXZA','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland C/ Conta-Gotas + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/NAVJ1NMQFA','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland S/ Conta-Gotas','https://seguro.loja-barbalenhador.com.br/pay/BUOJCBFR9A','Kirkland Frasco',true,'Barba Lenhador'),
('3 F/ Kirkland SEDEX','https://seguro.loja-barbalenhador.com.br/pay/KQCLN1UHBW','Kirkland Frasco',true,'Barba Lenhador'),
('3 FRASCOS + 3 MULTIVITAMÍNICOS + 1 DERMA ROLLER','https://seguro.loja-barbalenhador.com.br/pay/OZPGYNM4YG','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos + Dermaroller FG','https://seguro.loja-barbalenhador.com.br/pay/OTCED63CAQ','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos 219','https://seguro.loja-barbalenhador.com.br/pay/FYQW9QSSUA','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos 244 FG','https://seguro.loja-barbalenhador.com.br/pay/OKGY2MAITA','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos Minoxidil FG','https://seguro.loja-barbalenhador.com.br/pay/BGQIOUE26Q','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos Minoxidil FG 229','https://seguro.loja-barbalenhador.com.br/pay/I3XAY5QTHQ','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Frascos SEDEX','https://seguro.loja-barbalenhador.com.br/pay/YFXEMAFGMW','Minoxidil Frasco',true,'Barba Lenhador'),
('3 Multivitamínicos + 1 Esfoliante + 1 Hidratante + 1 Ativador tópico','https://seguro.loja-barbalenhador.com.br/pay/PJJQGEYACG','Kit',true,'Barba Lenhador'),
('4 Frascos de Minoxidil','https://seguro.loja-barbalenhador.com.br/pay/RWQH4ULQTG','Minoxidil Frasco',true,'Barba Lenhador'),
('4 Frascos de Minoxidil + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/TMWXAXCPGW','Minoxidil Frasco',true,'Barba Lenhador'),
('4 Frascos Minoxidil + 2 Ativadores','https://seguro.loja-barbalenhador.com.br/pay/5YPZXUBQYW','Minoxidil Frasco',true,'Barba Lenhador'),
('5 F/ Kirkland','https://seguro.loja-barbalenhador.com.br/pay/C8COVZGCZA','Kirkland Frasco',true,'Barba Lenhador'),
('8 Frascos de Kirkland','https://seguro.loja-barbalenhador.com.br/pay/0T4EWAKKDA','Kirkland Frasco',true,'Barba Lenhador'),
('9 F/ Kirkland + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/CQNBNX1TTA','Kirkland Frasco',true,'Barba Lenhador'),
('C/ Kirkland 429','https://seguro.loja-barbalenhador.com.br/pay/XJY1QQSNNG','Kirkland Caixa',true,'Barba Lenhador'),
('Caixa 409,90','https://seguro.loja-barbalenhador.com.br/pay/XCGCXJM5BW','Minoxidil Caixa',true,'Barba Lenhador'),
('Caixa Minox 414','https://seguro.loja-barbalenhador.com.br/pay/VMAWTUOCAA','Minoxidil Caixa',true,'Barba Lenhador'),
('Caixa Minoxidil + 1 Dermaroller + Pente de madeira','https://seguro.loja-barbalenhador.com.br/pay/EVSOY1OMAW','Minoxidil Caixa',true,'Barba Lenhador'),
('Derma roller','https://seguro.loja-barbalenhador.com.br/pay/UCB8ZEKIAA','Acessório',true,'Barba Lenhador'),
('Kit duo pomadas','https://seguro.loja-barbalenhador.com.br/pay/9GXLOSZO6G','Kit',true,'Barba Lenhador'),
('Kit Lenhador','https://seguro.loja-barbalenhador.com.br/pay/ACDUG1SAJG','Kit',true,'Barba Lenhador'),
('Kit lenhador + Dermaroller','https://seguro.loja-barbalenhador.com.br/pay/0ZBE2RWUG','Kit',true,'Barba Lenhador'),
('Kit Lenhador + Pomada efeito úmido','https://seguro.loja-barbalenhador.com.br/pay/DJPR0HMVA','Kit',true,'Barba Lenhador'),
('Kit Premium + Minoxidil','https://seguro.loja-barbalenhador.com.br/pay/ZD6KGHVU5W','Kit',true,'Barba Lenhador'),
('Máquina de acabamento','https://seguro.loja-barbalenhador.com.br/pay/SWOZWUP6SW','Acessório',true,'Barba Lenhador')
on conflict do nothing;

-- ============================================================
-- FIM DO SETUP — Execute e pronto!
-- ============================================================

-- ── TAREFAS ──
create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'prazo', -- 'diaria' | 'prazo'
  prioridade text not null default 'media', -- 'alta' | 'media' | 'baixa'
  status text not null default 'pendente', -- 'pendente' | 'andamento' | 'concluida'
  prazo date,
  empresa text default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_por_nome text,
  atribuido_para uuid references usuarios(id),
  atribuido_para_nome text,
  resetar_diario boolean default false,
  ultimo_reset date,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid references tarefas(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  usuario_nome text,
  texto text not null,
  criado_em timestamptz default now()
);

alter table tarefas enable row level security;
alter table tarefa_comentarios enable row level security;

drop policy if exists "allow_all_tarefas" on tarefas;
drop policy if exists "allow_all_comentarios" on tarefa_comentarios;

create policy "allow_all_tarefas"    on tarefas             for all using (true) with check (true);
create policy "allow_all_comentarios" on tarefa_comentarios  for all using (true) with check (true);

-- ── CLIENTES PENDENTES ──
create table if not exists clientes_pendentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  quantidade_frascos integer default 1,
  data_combinada date not null,
  observacao text,
  empresa text default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_por_nome text,
  criado_em timestamptz default now()
);

alter table clientes_pendentes enable row level security;

drop policy if exists "allow_all_clientes_pendentes" on clientes_pendentes;
create policy "allow_all_clientes_pendentes" on clientes_pendentes for all using (true) with check (true);

-- ── TAREFA SEMANAL: adiciona coluna de dias da semana ──
alter table tarefas add column if not exists dias_semana integer[] default null;
-- dias_semana: array de inteiros 0-6 (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab)
