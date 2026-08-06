const { sessaoDoRequest, json } = require('./_lib.js');

// GET /api/receita?contato=ID&negocio=ID&forcar=1
// Chama o fluxo do n8n que baixa a(s) receita(s) anexada(s), lê com IA e
// devolve quais produtos do catálogo estão liberados. O n8n guarda o
// resultado no contato (propriedade receita_liberada) como cache.
module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const urlN8n = (process.env.N8N_RECEITA_URL || '').trim();
  if (!urlN8n) return json(res, 200, { ok: false, configurado: false, erro: 'Falta a variável N8N_RECEITA_URL na Vercel' });

  const url = new URL(req.url, 'http://x');
  const contatoId = (url.searchParams.get('contato') || '').replace(/\D/g, '');
  const negocioId = (url.searchParams.get('negocio') || '').replace(/\D/g, '');
  const forcar = url.searchParams.get('forcar') === '1';
  if (!contatoId) return json(res, 400, { ok: false, erro: 'Informe o contato' });

  try {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 55000);
    const r = await fetch(urlN8n, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contatoId, negocioId, forcar }),
      signal: controle.signal,
    });
    clearTimeout(timer);
    const corpo = await r.json().catch(() => null);
    if (!r.ok || !corpo) return json(res, 502, { ok: false, erro: 'O n8n respondeu com erro (HTTP ' + r.status + ')' });
    return json(res, 200, corpo);
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'A leitura da receita demorou demais (mais de 55s)' : e.message;
    return json(res, 502, { ok: false, erro: msg });
  }
};

module.exports.config = { maxDuration: 60 };
