const { sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/agenda-link — usado pelo painel quando a receita está vencida.
// Descobre o MÉDICO RESPONSÁVEL do cliente no HubSpot e devolve o link da
// agenda exclusiva dele (horários fixos), já com o paciente embutido.
let cachePropMedico = { quando: 0, nome: '' };
async function propriedadeMedico() {
  const agora = Date.now();
  if (cachePropMedico.nome && agora - cachePropMedico.quando < 30 * 60 * 1000) return cachePropMedico.nome;
  let nome = (process.env.PROP_MEDICO_RESPONSAVEL || '').trim();
  if (!nome) {
    const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const r = await hs('/crm/v3/properties/contacts');
    const candidatas = (r.results || []).filter(p => norm(p.label).includes('medico'));
    const exata = candidatas.find(p => norm(p.label).includes('vincul')) || candidatas.find(p => norm(p.label).includes('respons'));
    nome = (exata || candidatas[0] || {}).name || '';
  }
  cachePropMedico = { quando: agora, nome };
  return nome;
}

module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s || !s.contatoId) return json(res, 401, { ok: false, erro: 'Sessão expirada — abra de novo pelo negócio' });
  try {
    const prop = await propriedadeMedico();
    if (!prop) return json(res, 400, { ok: false, erro: 'Não achei a propriedade de Médico Responsável no HubSpot (crave com PROP_MEDICO_RESPONSAVEL na Vercel)' });
    const ct = await hs('/crm/v3/objects/contacts/' + s.contatoId + '?properties=' + prop + ',firstname');
    const medico = String(ct.properties?.[prop] || '').trim();
    if (!medico) return json(res, 400, { ok: false, erro: 'Este cliente está sem Médico Responsável preenchido no HubSpot — preencha lá e tente de novo' });
    const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const url = base + '/agenda.html?medico=' + encodeURIComponent(medico)
      + '&contato=' + encodeURIComponent(s.contatoId)
      + '&chave=' + encodeURIComponent((process.env.PAINEL_CHAVE || '').trim());
    return json(res, 200, { ok: true, medico, url, propriedade: prop });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
