document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  loadDados();

  document.getElementById('formDados').addEventListener('submit', handleSalvarDados);
  document.getElementById('formSenha').addEventListener('submit', handleAlterarSenha);
});

function loadDados() {
  const user = getSessionUser();
  if (!user) return;

  document.getElementById('contaNome').value  = user.nome || '';
  document.getElementById('contaEmail').value = user.email || '';

  document.getElementById('infoRole').textContent   = user.role === 'admin' ? 'Administrador' : 'Atendente';
  document.getElementById('infoLojas').textContent   = user.empresa_nome || '—';
  document.getElementById('infoCriado').textContent = user.criado_em ? formatDateTime(user.criado_em) : '—';
}

async function handleSalvarDados(e) {
  e.preventDefault();
  const user  = getSessionUser();
  const nome  = document.getElementById('contaNome').value.trim();
  const email = document.getElementById('contaEmail').value.trim().toLowerCase();
  const msgEl = document.getElementById('msgDados');

  if (!nome || !email) return;

  try {
    await dbUpdateUsuario(user.id, { nome });

    let avisoEmail = '';
    if (email !== user.email) {
      await authUpdateEmail(email);
      avisoEmail = ' Verifique sua caixa de entrada pra confirmar o novo e-mail — ele só muda de verdade depois disso.';
    }

    // Atualiza cache local do perfil
    user.nome = nome;
    localStorage.setItem('fluxio_profile_v1', JSON.stringify(user));
    showUserInfo();

    msgEl.textContent = '✓ Dados atualizados!' + avisoEmail;
    msgEl.className = 'message ok';
  } catch(err) {
    msgEl.textContent = 'Erro: ' + (err.message || 'não foi possível salvar.');
    msgEl.className = 'message error';
  }
  setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'message'; }, 6000);
}

async function handleAlterarSenha(e) {
  e.preventDefault();
  const user  = getSessionUser();
  const atual = document.getElementById('senhaAtual').value;
  const nova  = document.getElementById('senhaNova').value;
  const nova2 = document.getElementById('senhaNova2').value;
  const msgEl = document.getElementById('msgSenha');

  if (nova !== nova2) {
    msgEl.textContent = 'As senhas novas não coincidem.';
    msgEl.className = 'message error';
    return;
  }

  try {
    // Reautentica com a senha atual pra confirmar que é você mesmo
    await authSignIn(user.email, atual);
    await authUpdatePassword(nova);

    document.getElementById('formSenha').reset();
    msgEl.textContent = '✓ Senha alterada com sucesso!';
    msgEl.className = 'message ok';
  } catch(err) {
    const msg = (err.message || '').toLowerCase().includes('incorret')
      ? 'Senha atual incorreta.'
      : 'Erro: ' + (err.message || 'não foi possível alterar.');
    msgEl.textContent = msg;
    msgEl.className = 'message error';
  }
  setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'message'; }, 4000);
}
