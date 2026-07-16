-- ════════════════════════════════════════════════════════
-- MIGRAÇÃO — Devoluções
-- Rode este script no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════

create table if not exists devolucoes (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text,
  cliente_nome text not null,
  whatsapp text,
  produtos text not null,
  motivo text not null default 'outro',
  -- motivo: duplicidade | recusado | endereco_incorreto | nao_retirado | avaria | outro
  transportadora text,
  codigo_rastreio text,
  data_retorno date,
  status text not null default 'aguardando_analise',
  -- status: aguardando_analise | reintegrado_estoque | reenviado | reembolsado | descartado
  valor numeric(10,2),
  observacoes text,
  empresa text not null default 'Barba Lenhador',
  criado_por uuid references usuarios(id),
  criado_por_nome text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

alter table devolucoes enable row level security;

drop policy if exists "allow_all_devolucoes" on devolucoes;
create policy "allow_all_devolucoes" on devolucoes for all using (true) with check (true);
