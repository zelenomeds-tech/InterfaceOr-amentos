const { USUARIOS, CFG, crypto, setCookieSessao, ownerPorEmail, json, lerBody } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Use POST' });
  if (!CFG.sessaoSecret) return json(res, 500, { ok: false, erro: 'Falta a variável SESSAO_SECRET na Vercel (Settings → Environment Variables → Redeploy)' });

  const { email, senha } = await lerBody(req);
  const emailNorm = String(email || '').trim().toLowerCase();
  const usuario = USUARIOS.find(u => u.email === emailNorm);
  const hash = crypto.createHash('sha256').update(String(senha || '')).digest('hex');

  if (!usuario || usuario.hash !== hash) {
    return json(res, 401, { ok: false, erro: 'E-mail ou senha incorretos' });
  }

  // Descobre o owner do HubSpot correspondente (não bloqueia o login se falhar)
  let owner = null;
  try { owner = await ownerPorEmail(emailNorm); } catch { /* diagnóstico mostra depois */ }

  const primeiroNome = emailNorm.split('@')[0].split('.')[0];
  const nome = (owner && owner.nome) || (primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1));

  setCookieSessao(res, { email: emailNorm, papel: usuario.papel, ownerId: owner ? owner.id : null, nome });
  return json(res, 200, { ok: true, email: emailNorm, papel: usuario.papel, nome, temOwner: !!owner });
};
