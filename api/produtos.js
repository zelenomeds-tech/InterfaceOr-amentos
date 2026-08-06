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
    const ativos = produtos.filter(p => p.ativo);
    // Válvula de segurança: se o filtro de Status zerar um catálogo que existe,
    // é sinal de propriedade/valor errado — mostra todos em vez de travar a
    // operação, e o /api/diagnostico aponta o ajuste (PROP_STATUS_PRODUTO /
    // VALOR_STATUS_ATIVO na Vercel).
    const lista = (ativos.length === 0 && produtos.length > 0) ? produtos : ativos;
    return json(res, 200, {
      ok: true,
      filtroAtivoFalhou: ativos.length === 0 && produtos.length > 0,
      produtos: lista.map(({ id, nome, preco, sku, descricao, foto }) => ({ id, nome, preco, sku, descricao, foto })),
    });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
