const { hs, json, lerBody } = require('./_lib.js');

// POST /api/agendar {chave, medico, contato, data:'AAAA-MM-DD', hora:'HH:MM'}
// Confirma o horário: reconfere o conflito e grava uma REUNIÃO no HubSpot
// associada ao paciente — a consulta aparece na linha do tempo do contato
// e o horário some da agenda do médico.
const FUSO = '-03:00';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Use POST' });
  const { chave, medico, contato, data, hora } = await lerBody(req);
  if ((chave || '').trim() !== (process.env.PAINEL_CHAVE || '').trim()) return json(res, 401, { ok: false, erro: 'Link inválido' });
  if (!medico || !contato || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !/^\d{2}:\d{2}$/.test(hora || '')) {
    return json(res, 400, { ok: false, erro: 'Dados incompletos do agendamento' });
  }
  const inicio = new Date(data + 'T' + hora + ':00' + FUSO).getTime();
  const duracao = 30 * 60 * 1000;
  if (!(inicio > Date.now())) return json(res, 400, { ok: false, erro: 'Este horário já passou — escolha outro' });

  try {
    // reconfere o conflito na hora de gravar (duas pessoas no mesmo slot)
    const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    try {
      const busca = await hs('/crm/v3/objects/meetings/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{ filters: [
            { propertyName: 'hs_meeting_start_time', operator: 'EQ', value: String(inicio) },
            { propertyName: 'hs_meeting_title', operator: 'CONTAINS_TOKEN', value: 'Zeleno' },
          ] }],
          properties: ['hs_meeting_title'],
          limit: 50,
        }),
      });
      const conflito = (busca.results || []).some(m => norm(m.properties?.hs_meeting_title).includes(norm(medico)));
      if (conflito) return json(res, 409, { ok: false, erro: 'Este horário acabou de ser ocupado — escolha outro' });
    } catch (e) { /* busca indisponível: segue e grava */ }

    let paciente = '';
    try {
      const ct = await hs('/crm/v3/objects/contacts/' + String(contato).replace(/\D/g, '') + '?properties=firstname,lastname');
      paciente = [ct.properties?.firstname, ct.properties?.lastname].filter(Boolean).join(' ') || 'Paciente';
    } catch (e) { paciente = 'Paciente'; }

    const reuniao = await hs('/crm/v3/objects/meetings', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_timestamp: String(inicio),
          hs_meeting_start_time: String(inicio),
          hs_meeting_end_time: String(inicio + duracao),
          hs_meeting_title: 'Consulta ' + medico + ' × ' + paciente + ' [Agenda Zeleno]',
          hs_meeting_body: 'Consulta de renovação de receita agendada pela interface Zeleno.',
          hs_meeting_outcome: 'SCHEDULED',
        },
        associations: [{
          to: { id: String(contato).replace(/\D/g, '') },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
        }],
      }),
    });
    return json(res, 200, { ok: true, id: String(reuniao.id), medico, paciente, data, hora });
  } catch (e) {
    return json(res, 502, { ok: false, erro: e.message });
  }
};
