const { sessaoDoRequest, catalogoProdutos, casarReceita, produtosVendaveis, hs, json, propStatusReceita, statusReceitaVencida } = require('./_lib.js');

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
    const textoBruto = await r.text();
    let corpo = null;
    try { corpo = JSON.parse(textoBruto); } catch (e) { /* mostra o bruto abaixo */ }
    if (!r.ok || !corpo) {
      return json(res, 502, { ok: false, erro: 'O n8n respondeu (HTTP ' + r.status + ') mas fora do formato: "' + String(textoBruto).slice(0, 200).replace(/\s+/g, ' ') + '"' });
    }

    // O n8n devolve o que a IA LEU na receita; quem decide o que libera é o
    // servidor, cruzando com o Grupo de Liberação do catálogo (regra fixa).
    // PROPRIEDADE OFICIAL "Status da receita" no contato: vencida/inválida MANDA
    try {
      const prop = await propStatusReceita();
      if (prop) {
        const ct = await hs('/crm/v3/objects/contacts/' + encodeURIComponent(contato) + '?properties=' + prop);
        if (statusReceitaVencida(ct.properties?.[prop])) {
          return json(res, 200, {
            ok: true, status: 'ok', receitaVencida: true,
            resumo: 'Status da receita no HubSpot: ' + (ct.properties?.[prop] || 'vencida'),
            itensReceita: [], liberados: [], grupos: [],
            observacoes: 'Bloqueio pela propriedade oficial do contato (Status da receita).',
          });
        }
      }
    } catch (e) { /* propriedade indisponível: segue pela leitura da IA */ }

    if (corpo.ok && corpo.status === 'ok' && Array.isArray(corpo.itensReceita)) {
      const { produtos } = await catalogoProdutos();
      // mesma válvula do /api/produtos: se o filtro de Status zerar, usa todos
      const ativos = produtosVendaveis(produtos);
      const base = ativos.length ? ativos : produtos;
      const casado = casarReceita(corpo.itensReceita, base);
      return json(res, 200, { ...corpo, liberados: casado.liberados, grupos: casado.grupos });
    }
    return json(res, 200, corpo);
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'A leitura da receita demorou demais (mais de 55s)' : e.message;
    return json(res, 502, { ok: false, erro: msg });
  }
};

module.exports.config = { maxDuration: 60 };
