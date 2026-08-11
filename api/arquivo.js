const { sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/arquivo?arquivo=ID — redireciona para o link temporário (signed URL)
// do arquivo no HubSpot. Só com sessão aberta pelo link do negócio.
module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada — abra de novo pelo negócio' });
  const url = new URL(req.url, 'http://x');
  const id = (url.searchParams.get('arquivo') || '').replace(/\D/g, '');
  if (!id) return json(res, 400, { ok: false, erro: 'Arquivo não informado' });
  try {
    const r = await hs('/files/v3/files/' + id + '/signed-url');
    if (!r.url) return json(res, 404, { ok: false, erro: 'Arquivo não encontrado' });
    res.statusCode = 302;
    res.setHeader('Location', r.url);
    res.end();
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
