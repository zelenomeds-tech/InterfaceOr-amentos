const { CFG, sessaoDoRequest, hs, json, lerBody } = require('./_lib.js');

// POST /api/orcamento
// Corpo: { negocioId, contatoId, itens: [{produtoId, nome, preco, quantidade,
//          descontoTipo ('%'|'R$'), descontoValor}], frete, freteNome }
// O desconto vai DENTRO do item de linha do produto (Desconto unitário do
// HubSpot: hs_discount_percentage para %, discount para R$), e o campo
// "Origem do Desconto" recebe "Desconto Pessoal" nos itens com desconto.

// Descobre sozinho a propriedade "Origem do Desconto" e o valor interno da
// opção "Desconto Pessoal" (dá para fixar com PROP_ORIGEM_DESCONTO e
// VALOR_ORIGEM_DESCONTO na Vercel, se um dia precisar).
let cacheOrigem = { quando: 0, dados: null };
function semAcento(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
async function origemDesconto() {
  const propEnv = (process.env.PROP_ORIGEM_DESCONTO || '').trim();
  if (propEnv) return { prop: propEnv, valor: (process.env.VALOR_ORIGEM_DESCONTO || 'Desconto Pessoal').trim() };
  const agora = Date.now();
  if (cacheOrigem.dados && agora - cacheOrigem.quando < 30 * 60 * 1000) return cacheOrigem.dados;
  let dados = null;
  try {
    const props = await hs('/crm/v3/properties/line_items');
    for (const p of (props.results || [])) {
      const rotulo = semAcento(p.label);
      if (rotulo.includes('origem') && rotulo.includes('desconto')) {
        const op = (p.options || []).find(o => semAcento(o.label).includes('pessoal'));
        dados = { prop: p.name, valor: op ? op.value : 'Desconto Pessoal' };
        break;
      }
    }
  } catch { /* sem a propriedade, os descontos entram mesmo assim, só sem a origem */ }
  cacheOrigem = { quando: agora, dados };
  return dados;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Use POST' });
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const { negocioId, contatoId, itens, frete, freteNome } = await lerBody(req);
  if (!negocioId) return json(res, 400, { ok: false, erro: 'Escolha o negócio' });
  if (!Array.isArray(itens) || !itens.length) return json(res, 400, { ok: false, erro: 'Adicione ao menos um produto' });

  const nFrete = Math.max(0, parseFloat(frete) || 0);
  const origem = await origemDesconto();

  // monta os itens já com desconto unitário e soma os totais
  let subtotal = 0, totalDescontos = 0;
  const propriedadesItens = itens.map(i => {
    const qtd = parseInt(i.quantidade) || 1;
    const preco = parseFloat(i.preco) || 0;
    const props = {
      hs_product_id: String(i.produtoId),
      name: i.nome || 'Produto',
      quantity: String(qtd),
      price: preco.toFixed(2),
    };
    let descUn = 0;
    const dv = parseFloat(i.descontoValor) || 0;
    if (dv > 0) {
      if (i.descontoTipo === '%') {
        const pct = Math.min(100, dv);
        props.hs_discount_percentage = String(pct);
        descUn = preco * pct / 100;
      } else {
        descUn = Math.min(preco, dv);
        props.discount = descUn.toFixed(2);
      }
      if (origem && origem.prop) props[origem.prop] = origem.valor; // Origem do Desconto = Desconto Pessoal
    }
    subtotal += preco * qtd;
    totalDescontos += descUn * qtd;
    return props;
  });
  const total = Math.max(0, subtotal - totalDescontos + nFrete);
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

    const inputs = propriedadesItens.map(props => ({ properties: props, associations: assoc }));

    if (nFrete > 0) {
      inputs.push({
        properties: { name: String(freteNome || 'Frete').slice(0, 100), quantity: '1', price: nFrete.toFixed(2) },
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
      subtotal, descontos: totalDescontos, frete: nFrete, total,
      linkHubspot, avisoOrcamento,
    });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
