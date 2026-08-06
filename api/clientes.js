const { CFG, sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/clientes?busca=texto
// Vendedor: só os contatos dele (hubspot_owner_id). Admin: todos.
module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });
  if (s.papel !== 'admin' && !s.ownerId) {
    return json(res, 400, { ok: false, erro: 'Seu e-mail não foi encontrado como usuário do HubSpot. Confira em /api/diagnostico.' });
  }

  const url = new URL(req.url, 'http://x');
  const busca = (url.searchParams.get('busca') || '').trim();

  const filtros = [];
  if (s.papel !== 'admin') {
    filtros.push({ propertyName: 'hubspot_owner_id', operator: 'EQ', value: s.ownerId });
  }

  const corpo = {
    filterGroups: [{ filters: filtros }],
    properties: ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'zip', 'city', 'state', CFG.propCpf],
    sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
    limit: 100,
  };
  if (busca) corpo.query = busca;
  if (!filtros.length) delete corpo.filterGroups;

  try {
    const r = await hs('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify(corpo) });
    const clientes = (r.results || []).map(c => {
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
    });
    return json(res, 200, { ok: true, total: r.total || clientes.length, clientes });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
