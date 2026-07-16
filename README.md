# Fluxio — v69

> Organização de pós-venda pra e-commerce. Repositório: `lupeexz/Fluxio.app` · Domínio: fluxio.app

## Estrutura

```
controle-reenvios/
├── index.html              ← Login + Novo cadastro (raiz)
├── assets/
│   ├── style.css           ← Estilos globais
│   ├── links.css           ← Estilos de links/sidebar
│   └── img/
│       ├── logo.png        ← Logo completa (ícone + wordmark + tagline)
│       └── icon.png        ← Ícone circular (favicon, sidebar, login)
├── js/
│   ├── config.js           ← ⚠️ Configure Supabase aqui
│   ├── db.js               ← Funções de banco de dados
│   ├── shared.js           ← Auth + helpers globais
│   ├── products.js         ← ⚠️ Depreciado — não usar como fonte de produtos
│   ├── app.js               ← Lógica do cadastro
│   └── pages/
│       ├── dashboard.js
│       ├── registros.js
│       ├── links.js
│       ├── melhores.js
│       ├── historico.js
│       ├── produtos.js
│       └── usuarios.js
├── pages/
│   ├── dashboard.html
│   ├── registros.html
│   ├── links.html
│   ├── melhores.html
│   ├── historico.html
│   ├── produtos.html
│   └── usuarios.html
└── sql/
    └── supabase_setup.sql  ← Cole no SQL Editor do Supabase
```

## Setup Supabase (5 min)

1. Acesse https://supabase.com → crie projeto gratuito
2. Vá em **SQL Editor** → cole `sql/supabase_setup.sql` → Execute
3. Vá em **Settings → API Keys** e copie:
   - **Project URL** → `SUPABASE_URL`
   - **Chave publicável** → `SUPABASE_ANON`
4. Edite `js/config.js` com os valores acima

## Login padrão

- **E-mail:** admin@barbalenhador.com.br
- **Senha:** admin123

⚠️ Troque a senha após o primeiro acesso em Usuários!

## GitHub Pages

```bash
git add .
git commit -m "v13"
git push
```

Settings → Pages → Branch main → root → Save
