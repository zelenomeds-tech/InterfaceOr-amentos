const { sessaoDoRequest, catalogoProdutos, json } = require('./_lib.js');

// GET /api/produtos — biblioteca de produtos do HubSpot (nome, preço, foto)
// Mostra SOMENTE produtos com Status = Ativo. A propriedade Status e o Grupo
// de Liberação são detectados sozinhos (fixáveis com PROP_STATUS_PRODUTO e
// PROP_GRUPO_LIBERACAO na Vercel).
module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  try {
    const { produtos } = await catalogoProdutos();
    const ativos = produtos
      .filter(p => p.ativo)
      .map(({ id, nome, preco, sku, descricao, foto }) => ({ id, nome, preco, sku, descricao, foto }));
    return json(res, 200, { ok: true, produtos: ativos });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
