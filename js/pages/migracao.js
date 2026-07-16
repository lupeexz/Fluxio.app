document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  if (!isAdmin()) { alert('Acesso restrito a administradores.'); window.location.href = '../index.html'; return; }
  showUserInfo();
});

function log(msg, type = '') {
  const el = document.getElementById('logBody');
  const cor = type === 'ok' ? 'var(--ok)' : type === 'err' ? 'var(--danger)' : type === 'warn' ? 'var(--warning)' : 'var(--text2)';
  el.innerHTML += `<div style="color:${cor}">[${new Date().toLocaleTimeString('pt-BR')}] ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

function setProgress(pct, text) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = text;
}

async function verificarBanco() {
  document.getElementById('logCard').classList.remove('hidden');
  try {
    const rows = await dbGetRegistros();
    log(`✓ Banco tem ${(rows||[]).length} registros atualmente.`, 'ok');
  } catch(e) {
    log('✗ Erro ao verificar banco: ' + e.message, 'err');
  }
}

async function iniciarMigracao() {
  if (!isSupabaseReady()) { alert('Configure o Supabase no config.js primeiro.'); return; }
  if (!confirm('Iniciar migração do Google Sheets para o Supabase?')) return;

  document.getElementById('btnMigrar').disabled = true;
  document.getElementById('progressCard').classList.remove('hidden');
  document.getElementById('logCard').classList.remove('hidden');
  document.getElementById('logBody').innerHTML = '';

  log('Buscando registros do Google Sheets...');
  setProgress(5, 'Conectando ao Google Sheets...');

  try {
    // Busca do Google Sheets
    const url = new URL(CONFIG.WEB_APP_URL);
    url.searchParams.set('action', 'list');
    url.searchParams.set('token', CONFIG.FORM_TOKEN);
    const resp   = await fetch(url.toString(), { cache: 'no-store' });
    const result = await resp.json();

    if (!result.ok && !result.success) throw new Error(result.error || 'Erro ao buscar planilha.');

    const records = result.records || [];
    log(`✓ ${records.length} registros encontrados no Google Sheets.`, 'ok');
    setProgress(20, `${records.length} registros encontrados...`);

    if (!records.length) { log('Nenhum registro para migrar.', 'warn'); setProgress(100, 'Concluído.'); return; }

    // Verifica duplicatas
    log('Verificando registros já existentes no banco...');
    const existing  = await dbGetRegistros();
    const existSet  = new Set((existing || []).map(r => r.numero_pedido + '_' + r.tipo));
    log(`→ ${existSet.size} registros já no banco.`);

    // Filtra apenas novos
    const novos = records.filter(r => !existSet.has((r.numeroPedido || '') + '_' + (r.tipo || '')));
    log(`→ ${novos.length} registros novos para importar.`, novos.length ? '' : 'warn');
    setProgress(30, `Importando ${novos.length} registros...`);

    if (!novos.length) {
      log('✓ Todos os registros já estão no banco!', 'ok');
      setProgress(100, 'Concluído — nada para migrar.');
      return;
    }

    // Importa em lotes de 20
    const BATCH = 20;
    let importados = 0;
    let erros = 0;

    for (let i = 0; i < novos.length; i += BATCH) {
      const lote = novos.slice(i, i + BATCH);
      await Promise.all(lote.map(async r => {
        try {
          await dbCreateRegistro({
            tipo:               r.tipo || '',
            loja:               r.loja || '',
            empresa:            getEmpresaNome(),
            empresa_id:         getEmpresaAtiva(),
            data_pedido:        r.dataPedido || null,
            motivo:             r.motivo || '',
            fretes_estorno:     r.fretesEstorno || '',
            numero_pedido:      r.numeroPedido || '',
            whatsapp:           r.whatsapp || '',
            novo_codigo_rastreio: r.novoCodigoRastreio || '',
            data_reenvio:       r.dataReenvio || null,
            usuario_nome:       'Migração',
          });
          importados++;
        } catch(e) {
          erros++;
          log(`✗ Erro no pedido ${r.numeroPedido}: ${e.message}`, 'err');
        }
      }));

      const pct = 30 + Math.round((i + lote.length) / novos.length * 65);
      setProgress(pct, `Importados ${importados} de ${novos.length}...`);
      log(`→ Lote ${Math.floor(i/BATCH)+1}: ${Math.min(i+BATCH, novos.length)}/${novos.length}`);
    }

    setProgress(100, 'Migração concluída!');
    log(`✓ Migração concluída! ${importados} importados, ${erros} erros.`, erros ? 'warn' : 'ok');
    clearRecordsCache();

  } catch(e) {
    log('✗ Erro fatal: ' + e.message, 'err');
    setProgress(0, 'Erro na migração.');
  } finally {
    document.getElementById('btnMigrar').disabled = false;
  }
}
