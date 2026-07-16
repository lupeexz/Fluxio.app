-- ════════════════════════════════════════════════════════════════
-- FASE 1 + 2 — Multi-empresa real + segurança com Supabase Auth
-- Rode este script INTEIRO no SQL Editor do Supabase, de uma vez.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Tabela de empresas (tenants) ──
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  cnpj text,
  telefone text,
  plano text not null default 'trial',
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

alter table empresas add column if not exists cnpj text;
alter table empresas add column if not exists telefone text;

-- ── 2) Perfis de usuário — linkados ao auth.users do Supabase ──
-- (senha/e-mail ficam no auth.users, gerenciados pelo próprio Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  email text,
  role text not null default 'atendente', -- admin | atendente
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

-- ── 3) Adiciona empresa_id em todas as tabelas de negócio ──
alter table registros           add column if not exists empresa_id uuid references empresas(id);
alter table tarefas             add column if not exists empresa_id uuid references empresas(id);
alter table produtos            add column if not exists empresa_id uuid references empresas(id);
alter table notas               add column if not exists empresa_id uuid references empresas(id);
alter table devolucoes          add column if not exists empresa_id uuid references empresas(id);
alter table envios_influencers  add column if not exists empresa_id uuid references empresas(id);
alter table clientes_pendentes  add column if not exists empresa_id uuid references empresas(id);
alter table historico_links     add column if not exists empresa_id uuid references empresas(id);
alter table tarefa_comentarios  add column if not exists empresa_id uuid references empresas(id);

-- ── 4) Cria a empresa "Barba Lenhador" e migra os dados existentes pra ela ──
insert into empresas (nome, slug, plano)
values ('Barba Lenhador', 'barba-lenhador', 'interno')
on conflict (slug) do nothing;

do $$
declare v_empresa_id uuid;
begin
  select id into v_empresa_id from empresas where slug = 'barba-lenhador';

  update registros           set empresa_id = v_empresa_id where empresa_id is null;
  update tarefas              set empresa_id = v_empresa_id where empresa_id is null;
  update produtos             set empresa_id = v_empresa_id where empresa_id is null;
  update notas                set empresa_id = v_empresa_id where empresa_id is null;
  update devolucoes           set empresa_id = v_empresa_id where empresa_id is null;
  update envios_influencers   set empresa_id = v_empresa_id where empresa_id is null;
  update clientes_pendentes   set empresa_id = v_empresa_id where empresa_id is null;
  update historico_links      set empresa_id = v_empresa_id where empresa_id is null;
end $$;

-- ── 5) Funções auxiliares de RLS (leem o perfil do usuário logado) ──
create or replace function auth_empresa_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select empresa_id from profiles where id = auth.uid()
$$;

create or replace function auth_is_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

-- ── 6) RLS real: cada empresa só vê os próprios dados ──
-- Repete o mesmo padrão pra cada tabela de negócio.

alter table empresas enable row level security;
drop policy if exists "allow_all_empresas" on empresas;
drop policy if exists "ve_propria_empresa" on empresas;
create policy "ve_propria_empresa" on empresas
  for select using (id = auth_empresa_id());

alter table profiles enable row level security;
drop policy if exists "ve_perfis_mesma_empresa" on profiles;
create policy "ve_perfis_mesma_empresa" on profiles
  for select using (empresa_id = auth_empresa_id());
drop policy if exists "admin_gerencia_perfis" on profiles;
create policy "admin_gerencia_perfis" on profiles
  for update using (auth_is_admin() and empresa_id = auth_empresa_id());
drop policy if exists "usuario_ve_proprio_perfil" on profiles;
create policy "usuario_ve_proprio_perfil" on profiles
  for select using (id = auth.uid());
drop policy if exists "sistema_cria_perfil" on profiles;
create policy "sistema_cria_perfil" on profiles
  for insert with check (id = auth.uid());

alter table registros enable row level security;
drop policy if exists "allow_all_registros" on registros;
create policy "empresa_isolada_registros" on registros
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table tarefas enable row level security;
drop policy if exists "allow_all_tarefas" on tarefas;
create policy "empresa_isolada_tarefas" on tarefas
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table tarefa_comentarios enable row level security;
drop policy if exists "allow_all_comentarios" on tarefa_comentarios;
create policy "empresa_isolada_comentarios" on tarefa_comentarios
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table produtos enable row level security;
drop policy if exists "allow_all_produtos" on produtos;
create policy "empresa_isolada_produtos" on produtos
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table notas enable row level security;
drop policy if exists "allow_all_notas" on notas;
create policy "empresa_isolada_notas" on notas
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table devolucoes enable row level security;
drop policy if exists "allow_all_devolucoes" on devolucoes;
create policy "empresa_isolada_devolucoes" on devolucoes
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table envios_influencers enable row level security;
drop policy if exists "allow_all_envios_influencers" on envios_influencers;
create policy "empresa_isolada_envios" on envios_influencers
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table clientes_pendentes enable row level security;
drop policy if exists "allow_all_clientes_pendentes" on clientes_pendentes;
create policy "empresa_isolada_clientes_pendentes" on clientes_pendentes
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

alter table historico_links enable row level security;
drop policy if exists "allow_all_historico" on historico_links;
create policy "empresa_isolada_historico" on historico_links
  for all using (empresa_id = auth_empresa_id()) with check (empresa_id = auth_empresa_id());

-- ── 7) Função de "criar empresa" — usada no signup self-serve ──
-- Cria a empresa E o perfil admin numa transação só, evitando empresa órfã.
create or replace function criar_empresa_e_admin(
  p_nome_empresa text,
  p_slug text,
  p_nome_usuario text,
  p_email text,
  p_cnpj text default null,
  p_telefone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_empresa_id uuid;
begin
  insert into empresas (nome, slug, plano, cnpj, telefone)
  values (p_nome_empresa, p_slug, 'trial', p_cnpj, p_telefone)
  returning id into v_empresa_id;

  insert into profiles (id, empresa_id, nome, email, role)
  values (auth.uid(), v_empresa_id, p_nome_usuario, p_email, 'admin');

  return v_empresa_id;
end;
$$;

-- ── 8) Busca segura de empresa por slug (usada no cadastro, antes de existir perfil) ──
-- security definer + retorna só o essencial (não vaza dados sensíveis de outras empresas)
create or replace function buscar_empresa_por_slug(p_slug text)
returns table(id uuid, nome text)
language sql stable
security definer
set search_path = public
as $$
  select id, nome from empresas where slug = p_slug and ativo = true
$$;

-- Fim. Depois de rodar, cada empresa nova que se cadastrar via app
-- só vai enxergar os próprios dados — inclusive a Barba Lenhador,
-- que já foi migrada pra sua própria empresa isolada acima.

-- ════════════════════════════════════════════════════════════════
-- ⚠️ PASSO MANUAL OBRIGATÓRIO — só pra quem já usava o sistema antes
-- ════════════════════════════════════════════════════════════════
-- Os logins antigos (senha SHA-256) NÃO existem mais no Supabase Auth.
-- Ninguém consegue entrar na Barba Lenhador até alguém virar admin dela.
--
-- 1) No app, vai em "Já tenho empresa", usa o código: barba-lenhador
--    (nome, seu e-mail, uma senha nova) — isso cria seu login e um
--    perfil PENDENTE (porque ainda não existe nenhum admin pra aprovar).
--
-- 2) Depois disso, roda o comando abaixo (troca o e-mail pelo que você
--    acabou de cadastrar) pra virar admin e já entrar direto:
--
--    update profiles set role = 'admin', ativo = true
--    where email = 'SEU_EMAIL_AQUI@exemplo.com';
--
-- 3) Depois desse primeiro admin, todo mundo mais do time só precisa
--    usar "Já tenho empresa" + código "barba-lenhador" e você aprova
--    pela página Usuários normalmente — sem precisar mexer no SQL de novo.
