// ⚠️ DEPRECIADO — este arquivo não é mais usado como fonte de produtos.
// Antigamente era um fallback estático, mas isso causava risco de mostrar
// links ANTIGOS (com preço errado) sem avisar ninguém, caso a busca no
// Supabase falhasse. Agora o sistema busca 100% do banco (tabela `produtos`)
// e mostra um erro visível se não conseguir.
//
// Gerencie os produtos pela página "Produtos" do sistema — tudo que estiver
// lá é a fonte real usada no Gerador de Links.
const PRODUCTS = [];
