-- ════════════════════════════════════════════════════════
-- MIGRAÇÃO v54 — Notas + Envios Influencers
-- Rode este script no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════

-- ── NOTAS (agora são pessoais — cada um vê só as suas) ──
create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  conteudo text not null,
  cor text not null default 'amarelo', -- amarelo | azul | verde | rosa | roxo
  fixado boolean not null default false,
  concluida boolean not null default false,
  data_alvo date,                       -- data pra fazer (opcional: hoje, amanhã, ou escolhida)
  empresa text not null default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_por_nome text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Se a tabela já existia (rodou a migração antiga), garante a coluna nova:
alter table notas add column if not exists data_alvo date;

alter table notas enable row level security;

drop policy if exists "allow_all_notas" on notas;
create policy "allow_all_notas" on notas for all using (true) with check (true);

-- ── ENVIOS INFLUENCERS ──
create table if not exists envios_influencers (
  id uuid primary key default gen_random_uuid(),
  influencer_nome text not null,
  rede_social text,          -- @usuario / plataforma
  whatsapp text,
  endereco text,
  produtos_enviados text,
  transportadora text,
  codigo_rastreio text,
  data_envio date,
  status text not null default 'aguardando', -- aguardando | enviado | entregue | postou
  link_conteudo text,
  observacoes text,
  empresa text not null default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_por_nome text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

alter table envios_influencers enable row level security;

drop policy if exists "allow_all_envios_influencers" on envios_influencers;
create policy "allow_all_envios_influencers" on envios_influencers for all using (true) with check (true);

-- ── (OPCIONAL) Página "Melhores links" foi removida ──
-- A tabela link_stats não é mais usada por nenhuma página. Se quiser limpar,
-- descomente a linha abaixo (isso apaga o histórico de contagem de cliques):
-- drop table if exists link_stats;
