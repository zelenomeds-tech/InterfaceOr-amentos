const { CFG, sessaoDoRequest, hs, json, lerBody } = require('./_lib.js');

// POST /api/orcamento
// Corpo: { clienteId, itens: [{produtoId, nome, preco, quantidade}], frete, desconto }
// Cria o negócio na etapa "Em Tratativa - Orçamento enviado" da Pipeline de
// vendas e recompra, associa o contato e cria os itens de linha no HubSpot:
// cada produto (com hs_product_id, igual está lá), Frete como item de linha
// e Desconto como item de linha com valor negativo.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Use POST' });
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const { clienteId, clienteNome, itens, frete, desconto, freteNome } = await lerBody(req);
  if (!clienteId) return json(res, 400, { ok: false, erro: 'Escolha o cliente' });
  if (!Array.isArray(itens) || !itens.length) return json(res, 400, { ok: false, erro: 'Adicione ao menos um produto' });

  const nFrete = Math.max(0, parseFloat(frete) || 0);
  const nDesconto = Math.max(0, parseFloat(desconto) || 0);
  const subtotal = itens.reduce((soma, i) => soma + (parseFloat(i.preco) || 0) * (parseInt(i.quantidade) || 1), 0);
  const total = Math.max(0, subtotal + nFrete - nDesconto);

  const dataBr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    // 1) Cria o negócio já associado ao contato
    const propsNegocio = {
      dealname: `Orçamento - ${clienteNome || 'Cliente'} - ${dataBr}`,
      pipeline: CFG.pipeline,
      dealstage: CFG.etapaOrcamento,
      amount: total.toFixed(2),
    };
    if (s.ownerId) propsNegocio.hubspot_owner_id = s.ownerId;
    if (CFG.origemValor) propsNegocio.origem = CFG.origemValor;

    const negocio = await hs('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({
        properties: propsNegocio,
        associations: [{
          to: { id: String(clienteId) },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }], // negócio → contato
        }],
      }),
    });
    const negocioId = String(negocio.id);

    // 2) Cria os itens de linha em lote, já associados ao negócio
    const assoc = [{
      to: { id: negocioId },
      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 20 }], // item de linha → negócio
    }];

    const inputs = itens.map(i => ({
      properties: {
        hs_product_id: String(i.produtoId),
        name: i.nome || 'Produto',
        quantity: String(parseInt(i.quantidade) || 1),
        price: (parseFloat(i.preco) || 0).toFixed(2),
      },
      associations: assoc,
    }));

    if (nFrete > 0) {
      inputs.push({
        properties: { name: String(freteNome || 'Frete').slice(0, 100), quantity: '1', price: nFrete.toFixed(2) },
        associations: assoc,
      });
    }
    if (nDesconto > 0) {
      inputs.push({
        properties: { name: 'Desconto', quantity: '1', price: (-nDesconto).toFixed(2) },
        associations: assoc,
      });
    }

    await hs('/crm/v3/objects/line_items/batch/create', {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });

    return json(res, 200, {
      ok: true,
      negocioId,
      numero: negocioId, // número do orçamento mostrado no documento
      data: dataBr,
      subtotal, frete: nFrete, desconto: nDesconto, total,
    });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
