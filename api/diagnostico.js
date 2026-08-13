const { CFG, hs, json, catalogoProdutos, produtosVendaveis, propriedadesDeAnexo, propStatusReceita } = require('./_lib.js');

// GET /api/diagnostico — abre no navegador para conferir a instalação.
// Mostra: variáveis, conexão com o HubSpot, quais e-mails da lista de login
// existem como usuários (owners) no HubSpot, e a etapa/pipeline configuradas.
module.exports = async (req, res) => {
  const variaveis = [
    { nome: 'HUBSPOT_TOKEN', estado: CFG.token ? 'ok' : 'faltando' },
    { nome: 'SESSAO_SECRET', estado: CFG.sessaoSecret ? 'ok' : 'faltando' },
    { nome: 'PAINEL_CHAVE', estado: (process.env.PAINEL_CHAVE || '').trim() ? 'ok' : 'faltando (é a chave do link do HubSpot)' },
    { nome: 'N8N_RECEITA_URL', estado: (process.env.N8N_RECEITA_URL || '').trim() ? 'ok' : 'faltando (leitura de receita desligada)' },
    { nome: 'PIPELINE_ID', estado: 'ok', valor: CFG.pipeline },
    { nome: 'ETAPA_ORCAMENTO', estado: 'ok', valor: CFG.etapaOrcamento },
    { nome: 'HUBSPOT_PROP_CPF', estado: 'ok', valor: CFG.propCpf },
    { nome: 'ORIGEM_VALOR', estado: CFG.origemValor ? 'ok' : 'vazio (opcional)', valor: CFG.origemValor },
  ];

  const saida = { ok: true, variaveis, hubspot: { conectado: false }, etapa: null };

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

      // Propriedade oficial "Status da receita"
      try { saida.statusReceita = { propriedadeDetectada: (await propStatusReceita()) || '⚠️ não encontrada' }; }
      catch (e) { saida.statusReceita = 'erro: ' + e.message; }

      // Propriedades de anexo descobertas (grupos de documentos do cabeçalho)
      try {
        const pa = await propriedadesDeAnexo();
        saida.documentos = {
          propriedadesDeAnexoContato: pa.contacts.map(p => p.name + ' → ' + p.titulo),
          propriedadesDeAnexoNegocio: pa.deals.map(p => p.name + ' → ' + p.titulo),
        };
      } catch (e) { saida.documentos = 'erro: ' + e.message; }

      // Catálogo: Status e Grupo de Liberação detectados + contagens
      try {
        const { produtos, propStatus, propGrupo, valorAtivo, candidatasStatus } = await catalogoProdutos();
        const contagemStatus = {};
        for (const p of produtos) { const v = p.statusBruto || '(vazio)'; contagemStatus[v] = (contagemStatus[v] || 0) + 1; }
        saida.catalogo = {
          propriedadeStatus: propStatus || '⚠️ não encontrada (todos os produtos aparecem)',
          propriedadesComStatusNoNome: candidatasStatus,
          valorConsideradoAtivo: valorAtivo || '',
          valoresDeStatusEncontrados: contagemStatus,
          propriedadeGrupo: propGrupo || '⚠️ não encontrada (nenhum produto casa com a receita)',
          categoriasEncontradas: [...new Set(produtos.filter(p => p.ativo).map(p => p.categoriaLoja || '(vazio)'))],
          filtroDeNome: (process.env.FILTRO_NOME_PRODUTO || 'anova (padrão)'),
          mostradosNoPainel: produtosVendaveis(produtos).length,
          ativos: produtos.filter(p => p.ativo).length,
          inativosOuSemStatus: produtos.filter(p => !p.ativo).length,
          ativosSemGrupo: produtos.filter(p => p.ativo && !p.categoria).map(p => p.nome),
        };
      } catch (e) {
        saida.catalogo = 'erro: ' + e.message;
      }

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

    } catch (e) {
      saida.hubspot.erro = e.message;
    }
  }

  return json(res, 200, saida);
};
