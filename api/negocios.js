const { CFG, sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/negocios?contato=ID
// Lista TODOS os negócios daquele contato, com pipeline e etapa.
// "selecionavel" marca em quais dá para lançar orçamento: os da Pipeline de
// vendas e recompra que ainda estão ANTES do pagamento. Negócios já pagos /
// enviados / entregues aparecem na lista, mas travados — mover um pedido pago
// de volta para "Orçamento enviado" bagunçaria o funil e os painéis.

// Etapas de pré-venda (antes do pagamento). Pode trocar sem mexer no código:
// variável ETAPAS_LISTA na Vercel, ids separados por vírgula.
const ETAPAS_PADRAO = [
  '1173938946', // Oportunidade qualificada - Consulta realizada
  '1173938945', // Nova Oportunidade De Recompra
  '1173938947', // Em Tratativa - Orçamento enviado
  '1289128497', // Orçamento aprovado
  '1362211507', // Link Expirado / Ajuste de Pedido
  '1173938948', // Link de Pagamento
];

let cachePipes = { quando: 0, etapas: null, pipelines: null };
async function mapas() {
  const agora = Date.now();
  if (!cachePipes.etapas || agora - cachePipes.quando > 30 * 60 * 1000) {
    const etapas = {}, pipelines = {};
    const pipes = await hs('/crm/v3/pipelines/deals');
    for (const p of (pipes.results || [])) {
      pipelines[String(p.id)] = p.label;
      for (const e of (p.stages || [])) etapas[String(e.id)] = e.label;
    }
    cachePipes = { quando: agora, etapas, pipelines };
  }
  return cachePipes;
}

module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const url = new URL(req.url, 'http://x');
  const contato = (url.searchParams.get('contato') || '').trim();
  if (!/^\d+$/.test(contato)) return json(res, 400, { ok: false, erro: 'Informe o contato' });

  const etapasEnv = (process.env.ETAPAS_LISTA || '').split(',').map(t => t.trim()).filter(Boolean);
  const preVenda = new Set(etapasEnv.length ? etapasEnv : ETAPAS_PADRAO);

  try {
    const assoc = await hs('/crm/v3/objects/contacts/' + contato + '/associations/deals');
    const ids = (assoc.results || []).map(a => String(a.id || a.toObjectId)).filter(Boolean);
    if (!ids.length) return json(res, 200, { ok: true, negocios: [] });

    const lidos = await hs('/crm/v3/objects/deals/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        inputs: ids.map(id => ({ id })),
        properties: ['dealname', 'dealstage', 'pipeline', 'amount', 'createdate'],
      }),
    });

    const { etapas, pipelines } = await mapas();
    const negocios = (lidos.results || []).map(n => {
      const p = n.properties || {};
      const etapaId = String(p.dealstage || '');
      const pipeId = String(p.pipeline || '');
      return {
        id: String(n.id),
        nome: p.dealname || '(sem nome)',
        etapaId,
        etapa: etapas[etapaId] || etapaId,
        pipeline: pipelines[pipeId] || pipeId,
        valor: parseFloat(p.amount) || 0,
        criadoEm: p.createdate || '',
        selecionavel: pipeId === CFG.pipeline && preVenda.has(etapaId),
      };
    });

    // selecionáveis primeiro, mais recentes primeiro dentro de cada grupo
    negocios.sort((a, b) => (b.selecionavel - a.selecionavel) || String(b.criadoEm).localeCompare(String(a.criadoEm)));

    return json(res, 200, { ok: true, negocios });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
