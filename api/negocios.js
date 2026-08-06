const { CFG, sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/negocios?busca=texto
// Lista os negócios do vendedor logado na Pipeline de vendas e recompra,
// nas etapas de pré-venda (antes do pagamento), com o cliente associado.
// Admin enxerga os negócios de todos.

// Etapas onde faz sentido gerar orçamento (antes do pagamento).
// Pode trocar sem mexer no código: variável ETAPAS_LISTA na Vercel,
// com os ids separados por vírgula.
const ETAPAS_PADRAO = [
  '1173938946', // Oportunidade qualificada - Consulta realizada
  '1173938945', // Nova Oportunidade De Recompra
  '1173938947', // Em Tratativa - Orçamento enviado
  '1289128497', // Orçamento aprovado
  '1362211507', // Link Expirado / Ajuste de Pedido
  '1173938948', // Link de Pagamento
];

let cacheEtapas = { quando: 0, rotulos: null };
async function rotulosEtapas() {
  const agora = Date.now();
  if (!cacheEtapas.rotulos || agora - cacheEtapas.quando > 30 * 60 * 1000) {
    const mapa = {};
    const pipes = await hs('/crm/v3/pipelines/deals');
    for (const p of (pipes.results || []))
      for (const e of (p.stages || [])) mapa[String(e.id)] = e.label;
    cacheEtapas = { quando: agora, rotulos: mapa };
  }
  return cacheEtapas.rotulos;
}

module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });
  if (s.papel !== 'admin' && !s.ownerId) {
    return json(res, 400, { ok: false, erro: 'Seu e-mail não foi encontrado como usuário do HubSpot. Confira em /api/diagnostico.' });
  }

  const url = new URL(req.url, 'http://x');
  const busca = (url.searchParams.get('busca') || '').trim();
  const etapas = (process.env.ETAPAS_LISTA || '').split(',').map(t => t.trim()).filter(Boolean);
  const listaEtapas = etapas.length ? etapas : ETAPAS_PADRAO;

  const filtros = [
    { propertyName: 'pipeline', operator: 'EQ', value: CFG.pipeline },
    { propertyName: 'dealstage', operator: 'IN', values: listaEtapas },
  ];
  if (s.papel !== 'admin') filtros.push({ propertyName: 'hubspot_owner_id', operator: 'EQ', value: s.ownerId });

  const corpo = {
    filterGroups: [{ filters: filtros }],
    properties: ['dealname', 'dealstage', 'amount', 'createdate'],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    limit: 100,
  };
  if (busca) corpo.query = busca;

  try {
    const r = await hs('/crm/v3/objects/deals/search', { method: 'POST', body: JSON.stringify(corpo) });
    const negocios = (r.results || []).map(n => ({
      id: String(n.id),
      nome: n.properties?.dealname || '(sem nome)',
      etapaId: String(n.properties?.dealstage || ''),
      criadoEm: n.properties?.createdate || '',
    }));

    // Associa cada negócio ao contato (cliente) dele
    const clientesPorNegocio = {};
    if (negocios.length) {
      const assoc = await hs('/crm/v3/associations/deals/contacts/batch/read', {
        method: 'POST',
        body: JSON.stringify({ inputs: negocios.map(n => ({ id: n.id })) }),
      });
      const idsContatos = new Set();
      const contatoDoNegocio = {};
      for (const a of (assoc.results || [])) {
        const primeiro = (a.to || [])[0];
        if (primeiro) { contatoDoNegocio[String(a.from.id)] = String(primeiro.id); idsContatos.add(String(primeiro.id)); }
      }
      if (idsContatos.size) {
        const contatos = await hs('/crm/v3/objects/contacts/batch/read', {
          method: 'POST',
          body: JSON.stringify({
            inputs: [...idsContatos].map(id => ({ id })),
            properties: ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'zip', 'city', CFG.propCpf],
          }),
        });
        const porId = {};
        for (const c of (contatos.results || [])) {
          const p = c.properties || {};
          porId[String(c.id)] = {
            id: String(c.id),
            nome: [p.firstname, p.lastname].filter(Boolean).join(' ') || '(sem nome)',
            email: p.email || '',
            telefone: p.phone || p.mobilephone || '',
            cpf: p[CFG.propCpf] || '',
            cep: p.zip || '',
          };
        }
        for (const [negId, ctId] of Object.entries(contatoDoNegocio)) {
          if (porId[ctId]) clientesPorNegocio[negId] = porId[ctId];
        }
      }
    }

    const rotulos = await rotulosEtapas();
    const saida = negocios.map(n => ({
      ...n,
      etapa: rotulos[n.etapaId] || n.etapaId,
      cliente: clientesPorNegocio[n.id] || null,
    }));

    return json(res, 200, { ok: true, total: r.total || saida.length, negocios: saida });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
