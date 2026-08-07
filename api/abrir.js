const { CFG, sessaoDoRequest, setCookieSessao, hs, json } = require('./_lib.js');

// GET /api/abrir?negocio=ID&chave=CHAVE
// Porta de entrada sem login: o link na propriedade do negócio no HubSpot
// aponta para cá. Valida a chave, carrega o negócio + cliente e abre a sessão.
const ETAPAS_PERMITIDAS = [
  '1173938946', // Oportunidade qualificada - Consulta realizada
  '1173938945', // Nova Oportunidade De Recompra
  '1173938947', // Em Tratativa - Orçamento enviado
  '1289128497', // Orçamento aprovado
  '1362211507', // Link Expirado / Ajuste de Pedido
  '1173938948', // Link de Pagamento
];

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const negocioId = (url.searchParams.get('negocio') || '').replace(/\D/g, '');
  const chave = (url.searchParams.get('chave') || '').trim();

  const chaveCerta = (process.env.PAINEL_CHAVE || '').trim();
  if (!chaveCerta) return json(res, 500, { ok: false, erro: 'Falta a variável PAINEL_CHAVE na Vercel (Settings → Environment Variables → Redeploy)' });
  if (chave !== chaveCerta) return json(res, 401, { ok: false, erro: 'Link inválido — abra pelo botão "Gerar orçamento" dentro do negócio no HubSpot' });
  if (!negocioId) return json(res, 400, { ok: false, erro: 'O link não trouxe o negócio — confira a propriedade no HubSpot' });

  try {
    const neg = await hs('/crm/v3/objects/deals/' + negocioId
      + '?properties=dealname,dealstage,pipeline,hubspot_owner_id&associations=contacts');

    const etapaId = String(neg.properties?.dealstage || '');
    const permitidas = (process.env.ETAPAS_LISTA || '').split(',').map(t => t.trim()).filter(Boolean);
    const lista = permitidas.length ? permitidas : ETAPAS_PERMITIDAS;
    if (String(neg.properties?.pipeline || '') !== CFG.pipeline || !lista.includes(etapaId)) {
      return json(res, 400, { ok: false, erro: 'Este negócio não está numa etapa de orçamento (já foi pago/enviado, ou é de outra pipeline).' });
    }

    const contatoId = neg.associations?.contacts?.results?.[0]?.id;
    if (!contatoId) return json(res, 400, { ok: false, erro: 'Este negócio não tem contato associado no HubSpot — associe o cliente lá primeiro.' });

    const ct = await hs('/crm/v3/objects/contacts/' + contatoId
      + '?properties=firstname,lastname,email,phone,mobilephone,zip,' + CFG.propCpf);
    const p = ct.properties || {};
    const cliente = {
      id: String(contatoId),
      nome: [p.firstname, p.lastname].filter(Boolean).join(' ') || '(sem nome)',
      email: p.email || '',
      telefone: p.phone || p.mobilephone || '',
      cpf: p[CFG.propCpf] || '',
      cep: p.zip || '',
    };

    // nome do vendedor = dono do negócio (para assinar o documento)
    let vendedor = '';
    const ownerId = String(neg.properties?.hubspot_owner_id || '');
    if (ownerId) {
      try {
        const ow = await hs('/crm/v3/owners/' + ownerId);
        vendedor = [ow.firstName, ow.lastName].filter(Boolean).join(' ');
      } catch (e) { /* sem nome, segue */ }
    }

    // sessão presa a ESTE negócio: o gerar só aceita ele
    setCookieSessao(res, { papel: 'vendedor', negocioId, contatoId: cliente.id, nome: vendedor });

    return json(res, 200, {
      ok: true,
      negocio: { id: negocioId, nome: neg.properties?.dealname || '(sem nome)', etapaId },
      cliente,
      vendedor,
    });
  } catch (e) {
    if (e.status === 404) return json(res, 404, { ok: false, erro: 'Negócio não encontrado no HubSpot — confira o link.' });
    return json(res, 502, { ok: false, erro: e.message });
  }
};
