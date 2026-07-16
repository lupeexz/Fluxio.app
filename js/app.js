document.addEventListener("DOMContentLoaded", async () => {
  if (isLoggedIn()) await tryShowSystem();

  $("loginForm").addEventListener("submit", handleLogin);
  $("entrarEmpresaForm").addEventListener("submit", handleEntrarEmpresa);
  $("entryForm")?.addEventListener("submit", handleSubmit);
  $("tipo")?.addEventListener("change", syncRequiredFields);
  $("tipo")?.addEventListener("change", atualizarLabelData);

  syncRequiredFields();
  atualizarLabelData();
});

// ── TABS ──
function switchTab(tab) {
  const tabs   = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-panel');
  panels.forEach(p => p.classList.add('hidden'));
  tabs.forEach(t => t.classList.remove('active'));

  const map = { login: [0, 'loginForm'], entrarEmpresa: [1, 'entrarEmpresaForm'] };
  const [idx, formId] = map[tab];
  tabs[idx].classList.add('active');
  $(formId).classList.remove('hidden');
}

// ── LOGIN ──
async function handleLogin(e) {
  e.preventDefault();
  const email = $("emailInput").value.trim().toLowerCase();
  const senha = $("passwordInput").value;
  const errEl = $("loginError");
  errEl.classList.add("hidden");

  if (!isSupabaseReady()) {
    errEl.textContent = "Sistema não configurado. Verifique o config.js.";
    errEl.classList.remove("hidden");
    return;
  }

  try {
    await authSignIn(email, senha);
    await tryShowSystem();
  } catch (err) {
    errEl.textContent = err.message || "Erro ao entrar.";
    errEl.classList.remove("hidden");
  }
}

// ── ENTRAR EM EMPRESA EXISTENTE (fica pendente até admin aprovar) ──
async function handleEntrarEmpresa(e) {
  e.preventDefault();
  const slug  = $("joinSlug").value.trim().toLowerCase();
  const nome  = $("joinNome").value.trim();
  const email = $("joinEmail").value.trim().toLowerCase();
  const senha = $("joinSenha").value;
  const msgEl = $("entrarEmpresaMsg");
  msgEl.className = 'message hidden';

  if (!isSupabaseReady()) {
    msgEl.textContent = "Sistema não configurado. Contate o administrador.";
    msgEl.className = 'message error';
    return;
  }

  try {
    const empresa = await dbGetEmpresaBySlug(slug);
    if (!empresa) {
      msgEl.textContent = "Código de empresa não encontrado. Confere com o admin do seu time.";
      msgEl.className = 'message error';
      return;
    }

    await authSignUp(email, senha);
    if (!isLoggedIn()) {
      msgEl.textContent = "Conta criada! Confirme seu e-mail e depois faça login pra ver o status da aprovação.";
      msgEl.className = 'message ok';
      return;
    }

    await dbCreatePerfil({ empresa_id: empresa.id, nome, email, role: 'atendente', ativo: false });
    await tryShowSystem();
  } catch (err) {
    msgEl.textContent = "Erro: " + (err.message || "não foi possível solicitar acesso.");
    msgEl.className = 'message error';
  }
}

// ── SISTEMA ──
async function tryShowSystem() {
  try {
    const perfil = await carregarPerfil();
    if (!perfil) {
      $("loginScreen").classList.remove("hidden");
      $("pendingScreen").classList.add("hidden");
      $("systemScreen").classList.add("hidden");
      return;
    }
    if (!perfil.ativo) {
      $("loginScreen").classList.add("hidden");
      $("pendingScreen").classList.remove("hidden");
      $("systemScreen").classList.add("hidden");
      return;
    }
    showSystem();
  } catch (e) {
    console.error('Erro ao carregar sistema:', e);
  }
}

function showSystem() {
  $("loginScreen").classList.add("hidden");
  $("pendingScreen").classList.add("hidden");
  $("systemScreen").classList.remove("hidden");
  showUserInfo();
  loadMiniStats();
  injectGlobalTopbar();
}

function syncRequiredFields() {
  const isReenvio = $("tipo").value === "Reenvio";
  $("dataReenvio").required = isReenvio;
  $("novoCodigoRastreio").required = isReenvio;
}

function atualizarLabelData() {
  $("dataAcaoLabel").textContent = $("tipo").value === "Cancelamento" ? "Data Cancelamento" : "Data Reenvio";
}

async function handleSubmit(e) {
  e.preventDefault();
  if ($("website").value) return;

  const empresaId   = getEmpresaAtiva();
  const empresaNome = getEmpresaNome();
  const payload = {
    tipo:               $("tipo").value,
    loja:               empresaNome,
    empresa:            empresaNome,
    empresa_id:         empresaId,
    dataPedido:         $("dataPedido").value,
    motivo:             $("motivo").value.trim(),
    fretesEstorno:      $("fretesEstorno").value.trim(),
    numeroPedido:       $("numeroPedido").value.trim(),
    whatsapp:           normalizeWhatsapp($("whatsapp").value),
    novoCodigoRastreio: $("novoCodigoRastreio").value.trim(),
    dataReenvio:        $("dataReenvio").value,
  };

  if (!empresaId || !payload.dataPedido || !payload.motivo || !payload.numeroPedido || !payload.whatsapp) {
    setMessage("Preencha todos os campos obrigatórios.", "error"); return;
  }
  if (payload.tipo === "Reenvio" && (!payload.dataReenvio || !payload.novoCodigoRastreio)) {
    setMessage("Para Reenvio, informe Data Reenvio e Novo Código de Rastreio.", "error"); return;
  }

  $("submitBtn").disabled = true;
  setMessage("Salvando...", "");

  try {
    await apiCreateRecord(payload);
    $("entryForm").reset();
    syncRequiredFields();
    atualizarLabelData();
    setMessage("Registro salvo com sucesso.", "ok");
    apiRefreshRecords().then(() => loadMiniStats()).catch(() => loadMiniStats());
  } catch (err) {
    setMessage(err.message || "Erro ao salvar.", "error");
  } finally {
    $("submitBtn").disabled = false;
  }
}

async function loadMiniStats() {
  try {
    const records = await apiGetRecords({ background: true });
    $("statCancelamento").textContent = records.filter(r => r.tipo === "Cancelamento").length;
    $("statReenvio").textContent      = records.filter(r => r.tipo === "Reenvio").length;
    $("statTotal").textContent        = records.length;
  } catch (e) { console.error(e); }
}

function setMessage(text, type) {
  $("formMessage").textContent = text;
  $("formMessage").className   = `message ${type || ""}`.trim();
}
