document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  if (!isSuperAdmin()) {
    alert('Essa página é restrita ao admin da plataforma Fluxio.');
    window.location.href = '../index.html';
    return;
  }
  showUserInfo();
  await loadPainelAdmin();
});

async function loadPainelAdmin() {
  try {
    const [empresas, perfis, registros, mensagens] = await Promise.all([
      dbGetTodasEmpresas(),
      dbGetTodosPerfis(),
      dbGetContagemPorEmpresa('registros'),
      dbGetMensagensSuporte(),
    ]);

    const pendentes = (perfis || []).filter(p => !p.ativo);

    // ── Stats gerais ──
    document.getElementById('statEmpresas').textContent  = (empresas || []).length;
    document.getElementById('statUsuarios').textContent  = (perfis || []).length;
    document.getElementById('statRegistros').textContent = (registros || []).length;
    document.getElementById('statPendentes').textContent = pendentes.length;

    // ── Solicitações pendentes (todas empresas) ──
    renderSolicitacoes(pendentes, empresas || []);

    // ── Mensagens de suporte ──
    renderSuporte(mensagens || []);

    // ── Empresas com contagens ──
    renderEmpresas(empresas || [], perfis || [], registros || []);
  } catch(e) {
    console.error(e);
    alert('Erro ao carregar painel: ' + e.message);
  }
}

function renderSolicitacoes(pendentes, empresas) {
  const sec = document.getElementById('solicitacoesSection');
  if (!pendentes.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';

  const nomeEmpresa = (id) => empresas.find(e => e.id === id)?.nome || '—';

  document.getElementById('solicitacoesBody').innerHTML = pendentes.map(p => `
    <tr>
      <td style="font-weight:600">${escapeHtml(p.nome)}</td>
      <td style="color:var(--muted)">${escapeHtml(p.email || '—')}</td>
      <td>${escapeHtml(nomeEmpresa(p.empresa_id))}</td>
      <td style="font-size:12px;color:var(--muted)">${formatDateTime(p.criado_em)}</td>
      <td class="actions">
        <button class="mini" style="background:var(--ok)" onclick="aprovarConta('${p.id}')">✓ Aprovar</button>
      </td>
    </tr>
  `).join('');
}

async function aprovarConta(id) {
  try {
    await dbUpdateUsuario(id, { ativo: true });
    await loadPainelAdmin();
  } catch(e) { alert('Erro: ' + e.message); }
}

function renderSuporte(mensagens) {
  const abertas = mensagens.filter(m => m.status === 'aberto');
  const empty = document.getElementById('suporteEmpty');
  const list  = document.getElementById('suporteList');

  if (!abertas.length) {
    empty.classList.remove('hidden');
    list.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = abertas.map(m => `
    <div class="card" style="padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
        <div>
          <p style="font-weight:700;margin:0;font-size:14px">${escapeHtml(m.assunto || 'Sem assunto')}</p>
          <p style="font-size:12px;color:var(--muted);margin:2px 0 0">${escapeHtml(m.usuario_nome || '—')} · ${escapeHtml(m.usuario_email || '—')} · ${formatDateTime(m.criado_em)}</p>
        </div>
        <button class="mini secondary" onclick="resolverSuporte('${m.id}')">✓ Marcar resolvido</button>
      </div>
      <p style="font-size:13px;color:var(--text2);line-height:1.6;margin:0">${escapeHtml(m.mensagem)}</p>
    </div>
  `).join('');
}

async function resolverSuporte(id) {
  try {
    await dbUpdateMensagemSuporte(id, { status: 'fechado' });
    await loadPainelAdmin();
  } catch(e) { alert('Erro: ' + e.message); }
}

function renderEmpresas(empresas, perfis, registros) {
  document.getElementById('empresasBody').innerHTML = empresas.length
    ? empresas.map(e => {
        const qtdUsuarios  = perfis.filter(p => p.empresa_id === e.id).length;
        const qtdRegistros = registros.filter(r => r.empresa_id === e.id).length;
        return `
          <tr>
            <td style="font-weight:600">${escapeHtml(e.nome)}</td>
            <td style="font-size:12px;color:var(--muted)">${escapeHtml(e.cnpj || '—')}</td>
            <td style="font-size:12px;color:var(--muted)">${escapeHtml(e.telefone || '—')}</td>
            <td><span class="pill">${escapeHtml(e.plano || 'trial')}</span></td>
            <td>${qtdUsuarios}</td>
            <td>${qtdRegistros}</td>
            <td style="font-size:12px;color:var(--muted)">${formatDateTime(e.criado_em)}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem">Nenhuma empresa ainda.</td></tr>`;
}
