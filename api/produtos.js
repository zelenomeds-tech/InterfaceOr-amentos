const { sessaoDoRequest, hs, json } = require('./_lib.js');

// GET /api/produtos — biblioteca de produtos do HubSpot (nome, preço, foto)
// Cache de 10 minutos em memória para não bater no HubSpot a cada abertura.
let cache = { quando: 0, dados: null };

module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false, erro: 'Sessão expirada, entre de novo' });

  const agora = Date.now();
  if (cache.dados && agora - cache.quando < 10 * 60 * 1000) {
    return json(res, 200, { ok: true, deCache: true, produtos: cache.dados });
  }

  try {
    const produtos = [];
    let after = '';
    do {
      const pag = await hs('/crm/v3/objects/products?limit=100&archived=false'
        + '&properties=name,price,description,hs_sku,hs_images'
        + (after ? '&after=' + after : ''));
      for (const pr of (pag.results || [])) {
        const p = pr.properties || {};
        const preco = parseFloat(p.price);
        // hs_images pode vir com várias URLs separadas por ; — usamos a primeira
        const foto = (p.hs_images || '').split(';')[0].trim();
        produtos.push({
          id: String(pr.id),
          nome: p.name || '(sem nome)',
          preco: isNaN(preco) ? 0 : preco,
          sku: p.hs_sku || '',
          descricao: p.description || '',
          foto,
        });
      }
      after = pag.paging?.next?.after || '';
    } while (after);

    produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    cache = { quando: agora, dados: produtos };
    return json(res, 200, { ok: true, deCache: false, produtos });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
