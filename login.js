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
