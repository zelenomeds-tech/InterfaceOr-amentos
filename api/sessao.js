const { sessaoDoRequest, json } = require('./_lib.js');

module.exports = async (req, res) => {
  const s = sessaoDoRequest(req);
  if (!s) return json(res, 401, { ok: false });
  return json(res, 200, { ok: true, email: s.email, papel: s.papel, nome: s.nome, temOwner: !!s.ownerId });
};
