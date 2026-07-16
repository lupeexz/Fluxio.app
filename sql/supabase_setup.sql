-- ============================================================
-- CONTROLE REENVIOS — Supabase Setup SQL
-- Cole isso no SQL Editor do Supabase e execute
-- ============================================================

-- 1. USUÁRIOS DO SISTEMA (funcionários)
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha_hash text not null, -- SHA-256 da senha
  role text not null default 'atendente', -- 'admin' | 'atendente'
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

-- 2. REGISTROS DE REENVIO/CANCELAMENTO
create table if not exists registros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, -- 'Cancelamento' | 'Reenvio' | 'Reenvio Pagante'
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
  criado_em timestamptz default now()
);

-- 3. PRODUTOS CUSTOMIZADOS
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  link_yampi text not null,
  categoria text not null,
  ativo boolean default true,
  criado_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

-- 4. HISTÓRICO DE LINKS
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

-- 5. CONTAGEM DE CÓPIAS (melhores links)
create table if not exists link_stats (
  id uuid primary key default gen_random_uuid(),
  nome_produto text unique not null,
  contagem integer default 1,
  atualizado_em timestamptz default now()
);

-- ── RLS (Row Level Security) ──
alter table usuarios        enable row level security;
alter table registros       enable row level security;
alter table produtos        enable row level security;
alter table historico_links enable row level security;
alter table link_stats      enable row level security;

-- Políticas: acesso via service_role (anon key com RLS desabilitado por ora)
-- Para produção, configure políticas por usuário autenticado

create policy "allow_all_registros"   on registros       for all using (true) with check (true);
create policy "allow_all_produtos"    on produtos         for all using (true) with check (true);
create policy "allow_all_historico"   on historico_links  for all using (true) with check (true);
create policy "allow_all_stats"       on link_stats       for all using (true) with check (true);
create policy "allow_all_usuarios"    on usuarios         for all using (true) with check (true);

-- ── USUÁRIO ADMIN PADRÃO ──
-- Senha padrão: admin123 (SHA-256 abaixo)
insert into usuarios (nome, email, senha_hash, role)
values (
  'Administrador',
  'admin@barbalenhador.com.br',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'admin'
) on conflict (email) do nothing;


-- ── SOLICITAÇÕES DE ACESSO ──
create table if not exists solicitacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha_hash text not null,
  status text not null default 'pendente', -- 'pendente' | 'aprovado' | 'recusado'
  criado_em timestamptz default now()
);

create policy "allow_all_solicitacoes" on solicitacoes for all using (true) with check (true);
alter table solicitacoes enable row level security;
