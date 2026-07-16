// ── AUTH (Supabase Auth real — substitui o login por SHA-256) ──
const AUTH_SESSION_KEY = 'fluxio_auth_session_v1';

function authUrl(path) {
  return CONFIG.SUPABASE_URL + '/auth/v1/' + path;
}

function getAuthSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); }
  catch { return null; }
}

function setAuthSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

// Retorna um access_token válido, renovando com o refresh_token se estiver expirado
async function getValidAccessToken() {
  const session = getAuthSession();
  if (!session) return null;

  const expiresAt = (session.expires_at || 0) * 1000;
  if (Date.now() < expiresAt - 60000) return session.access_token;

  // Expirado (ou perto disso) — tenta renovar
  try {
    const res = await fetch(authUrl('token?grant_type=refresh_token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) { clearAuthSession(); return null; }
    const data = await res.json();
    setAuthSession(data);
    return data.access_token;
  } catch {
    clearAuthSession();
    return null;
  }
}

// ── Cadastro de usuário (Supabase Auth) ──
async function authSignUp(email, senha) {
  const res = await fetch(authUrl('signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.SUPABASE_ANON },
    body: JSON.stringify({ email, password: senha }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || 'Erro ao criar conta.');
  if (data.access_token) setAuthSession(data);
  return data;
}

// ── Login ──
async function authSignIn(email, senha) {
  const res = await fetch(authUrl('token?grant_type=password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.SUPABASE_ANON },
    body: JSON.stringify({ email, password: senha }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.error || '';
    if (msg.toLowerCase().includes('invalid')) throw new Error('E-mail ou senha incorretos.');
    throw new Error(msg || 'Erro ao entrar.');
  }
  setAuthSession(data);
  return data;
}

// ── Logout ──
async function authSignOut() {
  const session = getAuthSession();
  if (session?.access_token) {
    try {
      await fetch(authUrl('logout'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': CONFIG.SUPABASE_ANON },
      });
    } catch { /* ignora erro de rede no logout */ }
  }
  clearAuthSession();
  localStorage.removeItem('fluxio_profile_v1');
}

// ── Troca de senha (usuário logado) ──
async function authUpdatePassword(novaSenha) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  const res = await fetch(authUrl('user'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_ANON,
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ password: novaSenha }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || 'Erro ao trocar senha.');
  return data;
}

// ── Troca de e-mail (exige confirmação por e-mail do Supabase) ──
async function authUpdateEmail(novoEmail) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  const res = await fetch(authUrl('user'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_ANON,
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ email: novoEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || 'Erro ao trocar e-mail.');
  return data;
}

function isLoggedIn() {
  return !!getAuthSession();
}
