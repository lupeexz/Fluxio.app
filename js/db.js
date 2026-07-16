// ── Supabase client wrapper ──
function isSupabaseReady() {
  return CONFIG.SUPABASE_URL &&
    !CONFIG.SUPABASE_URL.includes('COLE_AQUI') &&
    CONFIG.SUPABASE_ANON &&
    !CONFIG.SUPABASE_ANON.includes('COLE_AQUI');
}

async function sbFetch(path, options = {}) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + path;

  const headers = {
    'Content-Type': 'application/json',
    'Prefer':       options.prefer !== undefined ? options.prefer : 'return=representation',
    'apikey':       CONFIG.SUPABASE_ANON,
    ...(options.headers || {}),
  };

  // Usa o token do usuário logado (necessário pra RLS por empresa funcionar).
  // Sem sessão (ex: durante o próprio login/cadastro), cai pra chave anônima.
  const token = (typeof getValidAccessToken === 'function') ? await getValidAccessToken() : null;
  headers['Authorization'] = 'Bearer ' + (token || CONFIG.SUPABASE_ANON);

  const res = await fetch(url, {
    method:  options.method || 'GET',
    headers,
    body:    options.body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || err.hint || `HTTP ${res.status}`);
  }

  return res.status === 204 ? null : res.json();
}

// ── EMPRESAS / PERFIS ──
async function dbGetEmpresaBySlug(slug) {
  const rows = await sbFetch('rpc/buscar_empresa_por_slug', {
    method: 'POST',
    body: JSON.stringify({ p_slug: slug }),
  });
  return rows?.[0] || null;
}

async function dbCriarEmpresaEAdmin(nomeEmpresa, slug, nomeUsuario, email, cnpj, telefone) {
  return sbFetch('rpc/criar_empresa_e_admin', {
    method: 'POST',
    body: JSON.stringify({
      p_nome_empresa: nomeEmpresa, p_slug: slug, p_nome_usuario: nomeUsuario, p_email: email,
      p_cnpj: cnpj || null, p_telefone: telefone || null,
    }),
  });
}

async function dbGetMeuPerfil() {
  const rows = await sbFetch('profiles?select=*,empresas(nome,slug)&limit=1');
  return rows?.[0] || null;
}

async function dbGetPerfisDaEmpresa() {
  return sbFetch('profiles?select=*&order=nome.asc');
}

async function dbCreatePerfil(data) {
  return sbFetch('profiles', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdatePerfil(id, data) {
  return sbFetch(`profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ── USUÁRIOS (agora = profiles, ligado ao Supabase Auth) ──
async function dbGetUsuarios() {
  return sbFetch('profiles?select=*&order=nome.asc');
}

async function dbGetUsuario(email) {
  const rows = await sbFetch(`profiles?email=eq.${encodeURIComponent(email)}&select=*`);
  return rows?.[0] || null;
}

async function dbCreateUsuario(data) {
  return sbFetch('profiles', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateUsuario(id, data) {
  return sbFetch(`profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

async function dbDeleteUsuario(id) {
  // Desvincula registros e tarefas antes de remover (evita erro de FK)
  try { await sbFetch(`registros?usuario_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ usuario_id: null }), prefer: '' }); } catch {}
  try { await sbFetch(`produtos?criado_por=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ criado_por: null }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefas?criado_por=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ criado_por: null }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefas?atribuido_para=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'pendente' }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefa_comentarios?usuario_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ usuario_id: null }), prefer: '' }); } catch {}
  // Nota: isso remove o PERFIL (acesso ao Fluxio). A conta de login em si (auth.users)
  // só pode ser removida via API administrativa do Supabase (fora do app, por segurança).
  return sbFetch(`profiles?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── REGISTROS ──
async function dbGetRegistros() {
  return sbFetch('registros?select=*&order=criado_em.desc');
}

async function dbGetRegistrosByEmpresa(empresa) {
  return sbFetch(`registros?select=*&empresa_id=eq.${empresa}&order=criado_em.desc`);
}

async function dbCreateRegistro(data) {
  return sbFetch('registros', { method: 'POST', body: JSON.stringify(data) });
}

// ── PRODUTOS ──
async function dbGetProdutosBanco() {
  return sbFetch('produtos?select=*&ativo=eq.true&order=nome.asc');
}

async function dbGetProdutosByEmpresa(empresa) {
  return sbFetch(`produtos?select=*&empresa_id=eq.${empresa}&ativo=eq.true&order=nome.asc`);
}

async function dbCreateProduto(data) {
  return sbFetch('produtos', { method: 'POST', body: JSON.stringify(data) });
}

async function dbDeleteProduto(id) {
  return sbFetch(`produtos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
}

// ── HISTÓRICO LINKS ──
async function dbSaveHistoricoLink(data) {
  return sbFetch('historico_links', { method: 'POST', body: JSON.stringify(data) });
}

async function dbGetHistoricoLinks(limit = 100) {
  return sbFetch(`historico_links?select=*&order=criado_em.desc&limit=${limit}`);
}

// ── MULTI-EMPRESA ──
async function getAllProductsMerged() {
  if (!isSupabaseReady()) {
    throw new Error('Supabase não configurado — não é possível buscar produtos.');
  }
  const empresa = getEmpresaAtiva();
  const dbProds = await dbGetProdutosByEmpresa(empresa);
  return (dbProds || []).map(p => ({
    nome:       p.nome,
    link_yampi: p.link_yampi,
    categoria:  p.categoria,
    id:         p.id,
  }));
}

// ── TAREFAS ──
async function dbGetTarefas(filtros = {}) {
  let query = 'tarefas?select=*&order=criado_em.desc';
  if (filtros.atribuido_para) query += `&atribuido_para=eq.${filtros.atribuido_para}`;
  if (filtros.empresa) query += `&empresa_id=eq.${filtros.empresa}`;
  return sbFetch(query);
}

async function dbCreateTarefa(data) {
  return sbFetch('tarefas', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateTarefa(id, data) {
  return sbFetch(`tarefas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, atualizado_em: new Date().toISOString() }) });
}

async function dbDeleteTarefa(id) {
  return sbFetch(`tarefas?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── COMENTÁRIOS ──
async function dbGetComentarios(tarefaId) {
  return sbFetch(`tarefa_comentarios?tarefa_id=eq.${tarefaId}&order=criado_em.asc`);
}

async function dbCreateComentario(data) {
  return sbFetch('tarefa_comentarios', { method: 'POST', body: JSON.stringify(data) });
}

// ── EDITAR / REMOVER REGISTRO ──
async function dbUpdateRegistro(id, data) {
  return sbFetch(`registros?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

async function dbDeleteRegistro(id) {
  return sbFetch(`registros?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── NOTAS ──
async function dbGetNotas(empresa, usuarioId) {
  return sbFetch(`notas?select=*&empresa_id=eq.${empresa}&criado_por=eq.${usuarioId}&order=fixado.desc,data_alvo.asc.nullslast,criado_em.desc`);
}

async function dbCreateNota(data) {
  return sbFetch('notas', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateNota(id, data) {
  return sbFetch(`notas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, atualizado_em: new Date().toISOString() }) });
}

async function dbDeleteNota(id) {
  return sbFetch(`notas?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── ENVIOS INFLUENCERS ──
async function dbGetEnviosInfluencers(empresa) {
  return sbFetch(`envios_influencers?select=*&empresa_id=eq.${empresa}&order=criado_em.desc`);
}

async function dbCreateEnvioInfluencer(data) {
  return sbFetch('envios_influencers', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateEnvioInfluencer(id, data) {
  return sbFetch(`envios_influencers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, atualizado_em: new Date().toISOString() }) });
}

async function dbDeleteEnvioInfluencer(id) {
  return sbFetch(`envios_influencers?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── DEVOLUÇÕES ──
async function dbGetDevolucoes(empresa) {
  return sbFetch(`devolucoes?select=*&empresa_id=eq.${empresa}&order=criado_em.desc`);
}

async function dbCreateDevolucao(data) {
  return sbFetch('devolucoes', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateDevolucao(id, data) {
  return sbFetch(`devolucoes?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, atualizado_em: new Date().toISOString() }) });
}

async function dbDeleteDevolucao(id) {
  return sbFetch(`devolucoes?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── CLIENTES PENDENTES ──
async function dbGetClientesPendentes(empresa) {
  return sbFetch(`clientes_pendentes?select=*&empresa_id=eq.${empresa}&order=data_combinada.asc`);
}

async function dbCreateClientePendente(data) {
  return sbFetch('clientes_pendentes', { method: 'POST', body: JSON.stringify(data) });
}

async function dbDeleteClientePendente(id) {
  return sbFetch(`clientes_pendentes?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}
