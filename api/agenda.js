const { hs, json } = require('./_lib.js');

// ============================================================
// AGENDA DE CONSULTAS — horários fixos por médico
// ⚠️ AJUSTE AQUI os horários (ou crave por variável AGENDA_HORARIOS na
// Vercel com um JSON no mesmo formato). "dias": 1=seg ... 5=sex.
const PADRAO = {
  duracaoMin: 30,
  diasAFrente: 14,
  antecedenciaMinHoras: 2,
  dias: [1, 2, 3, 4, 5],
  horarios: ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'],
  porMedico: {}, // ex.: { "Dra. Ana": { "dias": [2,4], "horarios": ["10:00","10:30"] } }
};
function configAgenda(medico) {
  let cfg = PADRAO;
  try { const env = JSON.parse(process.env.AGENDA_HORARIOS || 'null'); if (env) cfg = { ...PADRAO, ...env, porMedico: env.porMedico || {} }; } catch (e) {}
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const chaveMedico = Object.keys(cfg.porMedico || {}).find(k => norm(k) === norm(medico));
  return { ...cfg, ...(chaveMedico ? cfg.porMedico[chaveMedico] : {}) };
}
// ============================================================

const FUSO = '-03:00'; // Brasília
const inicioDoDiaMs = dataISO => new Date(dataISO + 'T00:00:00' + FUSO).getTime();
const slotMs = (dataISO, hora) => new Date(dataISO + 'T' + hora + ':00' + FUSO).getTime();

// reuniões da agenda deste médico no período (marcador no título)
async function ocupados(medico, deMs, ateMs) {
  const ocupado = new Set();
  try {
    const busca = await hs('/crm/v3/objects/meetings/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [
          { propertyName: 'hs_meeting_start_time', operator: 'GTE', value: String(deMs) },
          { propertyName: 'hs_meeting_start_time', operator: 'LTE', value: String(ateMs) },
          { propertyName: 'hs_meeting_title', operator: 'CONTAINS_TOKEN', value: 'Zeleno' },
        ] }],
        properties: ['hs_meeting_start_time', 'hs_meeting_title'],
        limit: 200,
      }),
    });
    const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const m of (busca.results || [])) {
      if (norm(m.properties?.hs_meeting_title).includes(norm(medico))) {
        ocupado.add(Number(m.properties.hs_meeting_start_time));
      }
    }
  } catch (e) { /* sem busca de reuniões: agenda mostra tudo livre */ }
  return ocupado;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const chave = (url.searchParams.get('chave') || '').trim();
  const medico = (url.searchParams.get('medico') || '').trim();
  const contatoId = (url.searchParams.get('contato') || '').replace(/\D/g, '');
  if (chave !== (process.env.PAINEL_CHAVE || '').trim()) return json(res, 401, { ok: false, erro: 'Link inválido' });
  if (!medico) return json(res, 400, { ok: false, erro: 'Médico não informado no link' });

  try {
    let paciente = '';
    if (contatoId) {
      try {
        const ct = await hs('/crm/v3/objects/contacts/' + contatoId + '?properties=firstname,lastname');
        paciente = [ct.properties?.firstname, ct.properties?.lastname].filter(Boolean).join(' ');
      } catch (e) { /* segue sem o nome */ }
    }
    const cfg = configAgenda(medico);
    const agora = Date.now();
    const minimo = agora + cfg.antecedenciaMinHoras * 3600 * 1000;
    const hoje = new Date(agora + (-3 * 3600 * 1000)); // relógio de Brasília
    const dias = [];
    for (let d = 0; d < cfg.diasAFrente && dias.length < 10; d++) {
      const dt = new Date(hoje.getTime() + d * 86400 * 1000);
      const diaSemana = dt.getUTCDay();
      if (!cfg.dias.includes(diaSemana)) continue;
      const dataISO = dt.toISOString().slice(0, 10);
      dias.push({ data: dataISO, diaSemana });
    }
    const deMs = inicioDoDiaMs(dias[0].data);
    const ateMs = inicioDoDiaMs(dias[dias.length - 1].data) + 86400 * 1000;
    const cheios = await ocupados(medico, deMs, ateMs);
    const nomesDias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const saida = dias.map(d => ({
      data: d.data,
      rotulo: nomesDias[d.diaSemana] + ' ' + d.data.slice(8, 10) + '/' + d.data.slice(5, 7),
      slots: cfg.horarios.map(h => {
        const ms = slotMs(d.data, h);
        return { hora: h, livre: ms > minimo && !cheios.has(ms) };
      }),
    })).filter(d => d.slots.some(s => s.livre) || true);
    return json(res, 200, { ok: true, medico, paciente, duracaoMin: cfg.duracaoMin, dias: saida });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
