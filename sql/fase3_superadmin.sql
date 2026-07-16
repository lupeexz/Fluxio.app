-- ════════════════════════════════════════════════════════════════
-- FASE 3 — Painel Super Admin (visão geral da plataforma, só pra você)
-- Rode este script INTEIRO no SQL Editor do Supabase, depois da fase 1+2.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Lista de super admins (donos do Fluxio, não de uma empresa cliente) ──
create table if not exists super_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  criado_em timestamptz default now()
);

create or replace function auth_is_super_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists(select 1 from super_admins where id = auth.uid())
$$;

-- ── 2) Libera o super admin enxergar tudo, em toda tabela de negócio ──
-- (recria cada policy adicionando "ou você é super admin")

drop policy if exists "empresa_isolada_registros" on registros;
create policy "empresa_isolada_registros" on registros
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_tarefas" on tarefas;
create policy "empresa_isolada_tarefas" on tarefas
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_comentarios" on tarefa_comentarios;
create policy "empresa_isolada_comentarios" on tarefa_comentarios
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_produtos" on produtos;
create policy "empresa_isolada_produtos" on produtos
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_notas" on notas;
create policy "empresa_isolada_notas" on notas
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_devolucoes" on devolucoes;
create policy "empresa_isolada_devolucoes" on devolucoes
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_envios" on envios_influencers;
create policy "empresa_isolada_envios" on envios_influencers
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_clientes_pendentes" on clientes_pendentes;
create policy "empresa_isolada_clientes_pendentes" on clientes_pendentes
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

drop policy if exists "empresa_isolada_historico" on historico_links;
create policy "empresa_isolada_historico" on historico_links
  for all using (empresa_id = auth_empresa_id() or auth_is_super_admin())
  with check (empresa_id = auth_empresa_id() or auth_is_super_admin());

-- empresas: super admin vê todas
drop policy if exists "ve_propria_empresa" on empresas;
create policy "ve_propria_empresa" on empresas
  for select using (id = auth_empresa_id() or auth_is_super_admin());

-- profiles: super admin vê e edita todos
drop policy if exists "ve_perfis_mesma_empresa" on profiles;
create policy "ve_perfis_mesma_empresa" on profiles
  for select using (empresa_id = auth_empresa_id() or auth_is_super_admin());
drop policy if exists "admin_gerencia_perfis" on profiles;
create policy "admin_gerencia_perfis" on profiles
  for update using ((auth_is_admin() and empresa_id = auth_empresa_id()) or auth_is_super_admin());

-- ── 3) Mensagens de suporte ──
create table if not exists suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id),
  usuario_id uuid references auth.users(id),
  usuario_nome text,
  usuario_email text,
  assunto text,
  mensagem text not null,
  status text not null default 'aberto', -- aberto | respondido | fechado
  criado_em timestamptz default now()
);

alter table suporte_mensagens enable row level security;

drop policy if exists "cria_mensagem_suporte" on suporte_mensagens;
create policy "cria_mensagem_suporte" on suporte_mensagens
  for insert with check (auth.uid() is not null);

drop policy if exists "ve_propria_mensagem_ou_super_admin" on suporte_mensagens;
create policy "ve_propria_mensagem_ou_super_admin" on suporte_mensagens
  for select using (usuario_id = auth.uid() or auth_is_super_admin());

drop policy if exists "super_admin_atualiza_suporte" on suporte_mensagens;
create policy "super_admin_atualiza_suporte" on suporte_mensagens
  for update using (auth_is_super_admin());

-- ════════════════════════════════════════════════════════════════
-- ⚠️ PASSO MANUAL — só depois de já ter feito login pelo menos uma vez
-- ════════════════════════════════════════════════════════════════
-- Troca o e-mail abaixo pelo SEU (o mesmo que você usa pra logar no Fluxio)
-- e roda esse insert pra virar super admin (dono da plataforma):
--
-- insert into super_admins (id, nome)
-- select id, 'Gustavo' from auth.users where email = 'SEU_EMAIL_AQUI@exemplo.com'
-- on conflict (id) do nothing;
