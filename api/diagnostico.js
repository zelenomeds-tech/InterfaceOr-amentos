const { USUARIOS, CFG, hs, ownerPorEmail, json } = require('./_lib.js');

// GET /api/diagnostico — abre no navegador para conferir a instalação.
// Mostra: variáveis, conexão com o HubSpot, quais e-mails da lista de login
// existem como usuários (owners) no HubSpot, e a etapa/pipeline configuradas.
module.exports = async (req, res) => {
  const variaveis = [
    { nome: 'HUBSPOT_TOKEN', estado: CFG.token ? 'ok' : 'faltando' },
    { nome: 'SESSAO_SECRET', estado: CFG.sessaoSecret ? 'ok' : 'faltando' },
    { nome: 'PIPELINE_ID', estado: 'ok', valor: CFG.pipeline },
    { nome: 'ETAPA_ORCAMENTO', estado: 'ok', valor: CFG.etapaOrcamento },
    { nome: 'HUBSPOT_PROP_CPF', estado: 'ok', valor: CFG.propCpf },
    { nome: 'ORIGEM_VALOR', estado: CFG.origemValor ? 'ok' : 'vazio (opcional)', valor: CFG.origemValor },
  ];

  const saida = { ok: true, variaveis, hubspot: { conectado: false }, etapa: null, vendedores: [] };

  if (CFG.token) {
    try {
      // Confere a pipeline/etapa configuradas
      const pipes = await hs('/crm/v3/pipelines/deals');
      for (const p of (pipes.results || [])) {
        if (String(p.id) === CFG.pipeline) {
          const et = (p.stages || []).find(e => String(e.id) === CFG.etapaOrcamento);
          saida.etapa = { pipeline: p.label, etapa: et ? et.label : '⚠️ ETAPA NÃO ENCONTRADA NESTA PIPELINE' };
        }
      }
      saida.hubspot.conectado = true;

      // Propriedade "Origem do Desconto" dos itens de linha
      try {
        const propsLi = await hs('/crm/v3/properties/line_items');
        const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const p = (propsLi.results || []).find(x => norm(x.label).includes('origem') && norm(x.label).includes('desconto'));
        saida.origemDesconto = p
          ? { propriedade: p.name, rotulo: p.label, opcoes: (p.options || []).map(o => ({ rotulo: o.label, valorInterno: o.value })) }
          : '⚠️ nenhuma propriedade de item de linha com "Origem" e "Desconto" no nome — os descontos entram sem a origem';
      } catch (e) {
        saida.origemDesconto = 'erro ao listar propriedades: ' + e.message;
      }

      // Modelos de orçamento (para a variável MODELO_ORCAMENTO_ID, se quiser fixar um)
      try {
        const modelos = await hs('/crm/v3/objects/quote_template?limit=10&properties=hs_name');
        saida.modelosOrcamento = (modelos.results || []).map(m => ({ id: String(m.id), nome: m.properties?.hs_name || '' }));
        saida.modeloEmUso = (process.env.MODELO_ORCAMENTO_ID || '').trim() || (saida.modelosOrcamento[0] ? saida.modelosOrcamento[0].id + ' (primeiro da lista, padrão)' : 'nenhum encontrado');
      } catch (e) {
        saida.modelosOrcamento = 'erro ao listar: ' + e.message + ' — confira se o token tem o escopo de orçamentos (quotes)';
      }

      // Confere quais e-mails do login existem como owner
      for (const u of USUARIOS) {
        let owner = null;
        try { owner = await ownerPorEmail(u.email); } catch { /* já reportado acima */ }
        saida.vendedores.push({ email: u.email, papel: u.papel, existeNoHubSpot: !!owner });
      }
    } catch (e) {
      saida.hubspot.erro = e.message;
    }
  }

  return json(res, 200, saida);
};
