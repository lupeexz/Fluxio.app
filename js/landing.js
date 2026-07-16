document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('criarEmpresaForm');
  if (form) form.addEventListener('submit', handleCriarEmpresa);
});

function slugify(str) {
  return (str || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function handleCriarEmpresa(e) {
  e.preventDefault();
  const nomeEmpresa = document.getElementById('lpEmpNome').value.trim();
  const cnpj        = document.getElementById('lpCnpj').value.trim();
  const telefone    = document.getElementById('lpTelefone').value.trim();
  const seuNome     = document.getElementById('lpSeuNome').value.trim();
  const email       = document.getElementById('lpEmail').value.trim().toLowerCase();
  const senha       = document.getElementById('lpSenha').value;
  const msgEl       = document.getElementById('criarEmpresaMsg');
  const btn         = document.getElementById('criarEmpresaBtn');

  msgEl.className = 'lp-msg hidden';

  if (typeof isSupabaseReady !== 'function' || !isSupabaseReady()) {
    msgEl.textContent = 'Sistema não configurado. Tenta de novo em alguns minutos ou fala com a gente.';
    msgEl.className = 'lp-msg error';
    return;
  }

  const slug = slugify(nomeEmpresa) + '-' + Math.random().toString(36).slice(2, 6);

  btn.disabled = true;
  msgEl.textContent = 'Criando sua conta...';
  msgEl.className = 'lp-msg';

  try {
    await authSignUp(email, senha);

    if (!isLoggedIn()) {
      msgEl.textContent = 'Conta criada! Confirme seu e-mail (checa a caixa de entrada) e depois entra pelo botão "Entrar".';
      msgEl.className = 'lp-msg ok';
      btn.disabled = false;
      return;
    }

    await dbCriarEmpresaEAdmin(nomeEmpresa, slug, seuNome, email, cnpj, telefone);
    msgEl.textContent = 'Empresa criada! Redirecionando pro sistema...';
    msgEl.className = 'lp-msg ok';
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  } catch (err) {
    msgEl.textContent = 'Erro: ' + (err.message || 'não foi possível criar a empresa.');
    msgEl.className = 'lp-msg error';
    btn.disabled = false;
  }
}
