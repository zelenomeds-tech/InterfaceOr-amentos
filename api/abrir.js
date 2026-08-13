const { CFG, sessaoDoRequest, setCookieSessao, hs, json, propriedadesDeAnexo } = require('./_lib.js');

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
    const propsAnexo = await propriedadesDeAnexo();
    const propsNeg = ['dealname', 'dealstage', 'pipeline', 'hubspot_owner_id', ...propsAnexo.deals.map(p => p.name)];
    const neg = await hs('/crm/v3/objects/deals/' + negocioId
      + '?properties=' + propsNeg.join(',') + '&associations=contacts');

    const etapaId = String(neg.properties?.dealstage || '');
    const permitidas = (process.env.ETAPAS_LISTA || '').split(',').map(t => t.trim()).filter(Boolean);
    const lista = permitidas.length ? permitidas : ETAPAS_PERMITIDAS;
    if (String(neg.properties?.pipeline || '') !== CFG.pipeline || !lista.includes(etapaId)) {
      return json(res, 400, { ok: false, erro: 'Este negócio não está numa etapa de orçamento (já foi pago/enviado, ou é de outra pipeline).' });
    }

    const contatoId = neg.associations?.contacts?.results?.[0]?.id;
    if (!contatoId) return json(res, 400, { ok: false, erro: 'Este negócio não tem contato associado no HubSpot — associe o cliente lá primeiro.' });

    const propsCt = ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'zip', CFG.propCpf, ...propsAnexo.contacts.map(p => p.name)];
    const ct = await hs('/crm/v3/objects/contacts/' + contatoId + '?properties=' + propsCt.join(','));
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

    // documentos separados PELO TIPO: cada propriedade de anexo vira um grupo
    // ("Receita", "CNH"...); anexos soltos das notas caem nos grupos por nome.
    // Cada etapa é blindada: se uma falhar (ex.: escopo de notas), as outras seguem.
    let documentos = [];
    {
      // grupos canônicos do cadastro Zeleno
      const grupoCanonico = texto => {
        const n = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (/receita|prescri/.test(n)) return 'Receita';
        if (/termo|associativ|adesao/.test(n)) return 'Termo associativo';
        if (/comprovante|endereco|residenc|fatura|conta de/.test(n)) return 'Comprovante de residência';
        if (/\brg\b|cnh|identidad|cpf|passaporte|habilita|selfie|documento com foto|doc com foto/.test(n)) return 'Documento com foto';
        return 'Outros anexos';
      };
      const ORDEM = ['Receita', 'Documento com foto', 'Comprovante de residência', 'Termo associativo', 'Outros anexos'];
      const grupos = new Map();
      const registrar = (titulo, valor) => {
        for (const bruto of String(valor || '').split(/[;,\s]+/)) {
          const fid = bruto.trim();
          if (!/^\d{5,}$/.test(fid)) continue; // só ids de arquivo válidos
          if (!grupos.has(titulo)) grupos.set(titulo, new Set());
          grupos.get(titulo).add(fid);
        }
      };
      // 1) grupos oficiais: propriedades de anexo do contato e do negócio
      try {
        for (const p of propsAnexo.contacts) registrar(grupoCanonico(p.titulo), ct.properties?.[p.name]);
        for (const p of propsAnexo.deals) registrar(grupoCanonico(p.titulo), neg.properties?.[p.name]);
      } catch (e) { /* segue */ }

      // 2) anexos soltos das notas (se o token não tiver escopo de notas, só pula)
      const soltos = [];
      try {
        const jaTem = new Set([...grupos.values()].flatMap(s => [...s]));
        const notasBrutas = [];
        for (const [tipo, id] of [['contacts', contatoId], ['deals', negocioId]]) {
          const assocNotas = await hs('/crm/v3/objects/' + tipo + '/' + id + '/associations/notes');
          const idsNotas = (assocNotas.results || []).map(a => String(a.id || a.toObjectId)).filter(Boolean).slice(0, 180);
          // lote de leitura em blocos de 90 (limite do batch)
          for (let i = 0; i < idsNotas.length; i += 90) {
            const notas = await hs('/crm/v3/objects/notes/batch/read', {
              method: 'POST',
              body: JSON.stringify({ inputs: idsNotas.slice(i, i + 90).map(x => ({ id: x })), properties: ['hs_attachment_ids', 'hs_timestamp'] }),
            });
            notasBrutas.push(...(notas.results || []));
          }
        }
        // PRIMEIRO ordena todas por data (novas na frente), SÓ DEPOIS corta
        notasBrutas.sort((a, b) => String(b.properties?.hs_timestamp || '').localeCompare(String(a.properties?.hs_timestamp || '')));
        for (const n of notasBrutas) {
          for (const aid of String(n.properties?.hs_attachment_ids || '').split(';')) {
            const limpo = aid.trim();
            if (/^\d{5,}$/.test(limpo) && !jaTem.has(limpo) && !soltos.includes(limpo)) soltos.push(limpo);
          }
        }
            } catch (e) { /* sem escopo de notas: os grupos oficiais seguem valendo */ }

      // 3) detalhes dos arquivos (cada um blindado; no máximo 20)
      const todosIds = [...new Set([...[...grupos.values()].flatMap(s => [...s]), ...soltos])].slice(0, 24);
      const detalhes = new Map();
      await Promise.all(todosIds.map(async fid => {
        try {
          const f = await hs('/files/v3/files/' + fid);
          detalhes.set(fid, { id: fid, nome: (f.name || 'arquivo') + (f.extension ? '.' + f.extension : ''), tipo: f.extension || '' });
        } catch (e) { /* sem escopo de files ou arquivo apagado: pula este */ }
      }));

      // 4) soltos classificados pelo nome do arquivo, nos mesmos grupos canônicos
      for (const fid of soltos.slice(0, 16)) {
        const det = detalhes.get(fid);
        if (!det) continue;
        const titulo = grupoCanonico(det.nome);
        if (!grupos.has(titulo)) grupos.set(titulo, new Set());
        grupos.get(titulo).add(fid);
      }

      for (const [titulo, ids] of grupos) {
        const itens = [...ids].map(fid => detalhes.get(fid)).filter(Boolean);
        if (itens.length) documentos.push({ grupo: titulo, itens });
      }
      documentos.sort((a, b) => ORDEM.indexOf(a.grupo) - ORDEM.indexOf(b.grupo));
    }

    // orçamentos já existentes neste negócio (para o vendedor não duplicar sem saber)
    let orcamentosAnteriores = [];
    try {
      const assocOrc = await hs('/crm/v3/objects/deals/' + negocioId + '/associations/quotes');
      const ids = (assocOrc.results || []).map(a => String(a.id || a.toObjectId)).filter(Boolean);
      if (ids.length) {
        const lidos = await hs('/crm/v3/objects/quotes/batch/read', {
          method: 'POST',
          body: JSON.stringify({
            inputs: ids.map(id => ({ id })),
            properties: ['hs_title', 'hs_createdate', 'hs_expiration_date', 'hs_quote_link', 'hs_quote_amount'],
          }),
        });
        orcamentosAnteriores = (lidos.results || []).map(q => {
          const p = q.properties || {};
          return {
            id: String(q.id),
            titulo: p.hs_title || 'Orçamento',
            criadoEm: p.hs_createdate || '',
            validade: p.hs_expiration_date || '',
            link: p.hs_quote_link || '',
            valor: parseFloat(p.hs_quote_amount) || 0,
          };
        }).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      }
    } catch (e) { /* sem escopo de quotes ou sem orçamentos: segue sem a lista */ }

    // sessão presa a ESTE negócio: o gerar só aceita ele
    setCookieSessao(res, { papel: 'vendedor', negocioId, contatoId: cliente.id, nome: vendedor });

    return json(res, 200, {
      ok: true,
      negocio: { id: negocioId, nome: neg.properties?.dealname || '(sem nome)', etapaId },
      cliente,
      vendedor,
      motorDocumentos: 'v4-funil',
      documentos,
      orcamentosAnteriores,
    });
  } catch (e) {
    if (e.status === 404) return json(res, 404, { ok: false, erro: 'Negócio não encontrado no HubSpot — confira o link.' });
    return json(res, 502, { ok: false, erro: e.message });
  }
};
