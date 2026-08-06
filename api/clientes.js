const { CFG, sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/clientes?busca=texto
// Vendedor: só os contatos dele. Admin: todos.
// A busca aceita nome, e-mail, CPF ou o ID do registro do contato no HubSpot
// (se for só número, ele tenta abrir o contato direto por ID).
module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });
  if (s.papel !== 'admin' && !s.ownerId) {
    return json(res, 400, { ok: false, erro: 'Seu e-mail não foi encontrado como usuário do HubSpot. Confira em /api/diagnostico.' });
  }

  const url = new URL(req.url, 'http://x');
  const busca = (url.searchParams.get('busca') || '').trim();
  const props = ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'zip', 'city', 'hubspot_owner_id', CFG.propCpf];

  const montar = c => {
    const p = c.properties || {};
    return {
      id: String(c.id),
      nome: [p.firstname, p.lastname].filter(Boolean).join(' ') || '(sem nome)',
      email: p.email || '',
      telefone: p.phone || p.mobilephone || '',
      cpf: p[CFG.propCpf] || '',
      cep: p.zip || '',
      cidade: p.city || '',
    };
  };

  try {
    // Busca por ID do registro: só números com 3+ dígitos.
    // Pode ser ID de CONTATO ou ID de NEGÓCIO (o vendedor copia o que estiver na tela).
    if (/^\d{3,}$/.test(busca)) {
      // 1) tenta como contato
      try {
        const c = await hs('/crm/v3/objects/contacts/' + busca + '?properties=' + props.join(','));
        const dono = String(c.properties?.hubspot_owner_id || '');
        if (s.papel === 'admin' || dono === String(s.ownerId)) {
          return json(res, 200, { ok: true, total: 1, clientes: [montar(c)] });
        }
        return json(res, 200, { ok: true, total: 0, clientes: [], aviso: 'Esse ID existe, mas o contato não é seu.' });
      } catch { /* não é contato: tenta como negócio */ }

      // 2) tenta como negócio → devolve o cliente associado a ele
      try {
        const n = await hs('/crm/v3/objects/deals/' + busca + '?properties=hubspot_owner_id&associations=contacts');
        const donoNegocio = String(n.properties?.hubspot_owner_id || '');
        if (s.papel !== 'admin' && donoNegocio !== String(s.ownerId)) {
          return json(res, 200, { ok: true, total: 0, clientes: [], aviso: 'Esse ID é de um negócio, mas ele não é seu.' });
        }
        const contatoId = n.associations?.contacts?.results?.[0]?.id;
        if (!contatoId) {
          return json(res, 200, { ok: true, total: 0, clientes: [], aviso: 'Esse negócio não tem contato associado no HubSpot. Associe o contato lá primeiro.' });
        }
        const c = await hs('/crm/v3/objects/contacts/' + contatoId + '?properties=' + props.join(','));
        // aqui não checa o dono do contato: o negócio é do vendedor, isso basta
        return json(res, 200, { ok: true, total: 1, clientes: [montar(c)] });
      } catch { /* não achou por ID: cai na busca normal (pode ser CPF) */ }
    }

    const filtros = [];
    if (s.papel !== 'admin') filtros.push({ propertyName: 'hubspot_owner_id', operator: 'EQ', value: s.ownerId });

    const corpo = {
      properties: props,
      sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
      limit: 100,
    };
    if (filtros.length) corpo.filterGroups = [{ filters: filtros }];
    if (busca) corpo.query = busca;

    const r = await hs('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify(corpo) });
    return json(res, 200, { ok: true, total: r.total || 0, clientes: (r.results || []).map(montar) });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
