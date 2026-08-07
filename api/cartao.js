const { json } = require('./_lib.js');

// GET /api/cartao?chave=CHAVE&associatedObjectId=ID_DO_NEGOCIO
// Endpoint do CARTÃO DE CRM do app privado: o HubSpot chama esta URL ao abrir
// um negócio e recebe de volta um cartão com o botão "Gerar orçamento", que
// abre a interface DENTRO do HubSpot (janela iframe).
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const chave = (url.searchParams.get('chave') || '').trim();
  const negocioId = (url.searchParams.get('associatedObjectId') || '').replace(/\D/g, '');

  const chaveCerta = (process.env.PAINEL_CHAVE || '').trim();
  if (!chaveCerta || chave !== chaveCerta) return json(res, 401, { results: [] });
  if (!negocioId) return json(res, 200, { results: [] });

  const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  const uri = base + '/?negocio=' + negocioId + '&chave=' + encodeURIComponent(chaveCerta);

  return json(res, 200, {
    results: [{
      objectId: Number(negocioId),
      title: 'Orçamento Zeleno',
      properties: [
        { label: 'Como usar', dataType: 'STRING', value: 'Clique em "Gerar orçamento" abaixo' },
      ],
    }],
    primaryAction: {
      type: 'IFRAME',
      width: 1280,
      height: 860,
      uri,
      label: 'Gerar orçamento',
    },
  });
};
