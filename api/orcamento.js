const { CFG, sessaoDoRequest, hs, json, lerBody } = require('./_lib.js');

// POST /api/orcamento
// Corpo: { negocioId, itens: [{produtoId, nome, preco, quantidade}], frete, desconto, freteNome }
// AGORA O ORÇAMENTO ENTRA NO NEGÓCIO QUE JÁ EXISTE:
//  1. move o negócio para a etapa "Em Tratativa - Orçamento enviado"
//  2. atualiza o valor (amount) para o total do orçamento
//  3. substitui os itens de linha do negócio pelos do orçamento:
//     produtos da biblioteca (hs_product_id), Frete e Desconto (negativo).
//     Substituir evita duplicar itens quando o vendedor gera de novo.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Use POST' });
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const { negocioId, contatoId, itens, frete, desconto, freteNome } = await lerBody(req);
  if (!negocioId) return json(res, 400, { ok: false, erro: 'Escolha o negócio' });
  if (!Array.isArray(itens) || !itens.length) return json(res, 400, { ok: false, erro: 'Adicione ao menos um produto' });

  const nFrete = Math.max(0, parseFloat(frete) || 0);
  const nDesconto = Math.max(0, parseFloat(desconto) || 0);
  const subtotal = itens.reduce((soma, i) => soma + (parseFloat(i.preco) || 0) * (parseInt(i.quantidade) || 1), 0);
  const total = Math.max(0, subtotal + nFrete - nDesconto);
  const dataBr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    // 1) Move o negócio para a etapa do orçamento e atualiza o valor
    await hs('/crm/v3/objects/deals/' + encodeURIComponent(negocioId), {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { dealstage: CFG.etapaOrcamento, amount: total.toFixed(2) },
      }),
    });

    // 2) Remove os itens de linha antigos do negócio (evita duplicar ao regerar)
    const antigos = await hs('/crm/v3/objects/deals/' + encodeURIComponent(negocioId) + '/associations/line_items');
    const idsAntigos = (antigos.results || []).map(a => String(a.id || a.toObjectId)).filter(Boolean);
    if (idsAntigos.length) {
      await hs('/crm/v3/objects/line_items/batch/archive', {
        method: 'POST',
        body: JSON.stringify({ inputs: idsAntigos.map(id => ({ id })) }),
      });
    }

    // 3) Cria os itens de linha novos, associados ao negócio
    const assoc = [{
      to: { id: String(negocioId) },
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

    // 4) Cria o ORÇAMENTO nativo do HubSpot (quadro "Orçamentos" do negócio),
    //    usando o modelo de vocês, e publica para gerar o link do cliente.
    //    Se algo aqui falhar (ex.: falta escopo de quotes no token), o resto
    //    já foi salvo — devolve um aviso em vez de derrubar tudo.
    let linkHubspot = '', avisoOrcamento = '';
    try {
      // modelo: usa MODELO_ORCAMENTO_ID da Vercel; sem ela, pega o primeiro modelo da conta
      let modeloId = (process.env.MODELO_ORCAMENTO_ID || '').trim();
      if (!modeloId) {
        const modelos = await hs('/crm/v3/objects/quote_template?limit=10&properties=hs_name');
        modeloId = String(modelos.results?.[0]?.id || '');
      }
      if (!modeloId) throw new Error('Nenhum modelo de orçamento encontrado no HubSpot');

      const validade = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const assocOrc = [
        { to: { id: String(negocioId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 64 }] },  // orçamento → negócio
        { to: { id: modeloId },          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 286 }] }, // orçamento → modelo
      ];
      if (contatoId) {
        assocOrc.push({ to: { id: String(contatoId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 69 }] }); // orçamento → contato
      }

      const orc = await hs('/crm/v3/objects/quotes', {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            hs_title: 'Orçamento - ' + dataBr,
            hs_expiration_date: validade,
          },
          associations: assocOrc,
        }),
      });
      const orcamentoId = String(orc.id);

      // o orçamento precisa dos PRÓPRIOS itens de linha (cópias dos do negócio)
      // ⚠️ sentido da associação: item de linha → orçamento = 68 (67 é o inverso e dá erro de limite)
      const assocItemOrc = [{ to: { id: orcamentoId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 68 }] }];
      await hs('/crm/v3/objects/line_items/batch/create', {
        method: 'POST',
        body: JSON.stringify({ inputs: inputs.map(i => ({ properties: i.properties, associations: assocItemOrc })) }),
      });

      // publica (sem fluxo de aprovação) para gerar o link
      await hs('/crm/v3/objects/quotes/' + orcamentoId, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { hs_status: 'APPROVAL_NOT_NEEDED' } }),
      });
      const pronto = await hs('/crm/v3/objects/quotes/' + orcamentoId + '?properties=hs_quote_link,hs_status');
      linkHubspot = pronto.properties?.hs_quote_link || '';
    } catch (e) {
      avisoOrcamento = 'Itens de linha e etapa salvos, mas o orçamento do quadro "Orçamentos" não foi criado: ' + e.message;
    }

    return json(res, 200, {
      ok: true,
      negocioId: String(negocioId),
      numero: String(negocioId),
      data: dataBr,
      subtotal, frete: nFrete, desconto: nDesconto, total,
      linkHubspot, avisoOrcamento,
    });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
