// ============================================================
// ORÇAMENTO ZELENO — biblioteca compartilhada do backend
// (arquivos que começam com "_" não viram rota na Vercel)
// ============================================================
const crypto = require('crypto');

// ---------- USUÁRIOS ----------
// Senha NUNCA fica aqui em texto puro: guardamos só o hash SHA-256.
// Para trocar a senha de alguém: node -e "console.log(require('crypto').createHash('sha256').update('NOVA-SENHA').digest('hex'))"
// e substitua o hash da pessoa abaixo.
const USUARIOS = [
  { email: 'roberta.pinheiro@zelenomeds.com',   hash: '7577b8610b0841d3b966ccb95c1de5473f9b72036d6ac8cd2cd015748cd1117b', papel: 'vendedor' },
  { email: 'bruno.macedo@zelenomeds.com',       hash: 'bf0827640f758804c6b100a64327d7e418e5a0de0f00d11aa9fe50cca6bd7c62', papel: 'vendedor' },
  { email: 'ellen.priscila@zelenomeds.com',     hash: '1ec56ecc46acbe072fdb0b225e0a1791620b2a6ec9c77c74a98aa4c87c4421e0', papel: 'vendedor' },
  { email: 'mariana.santos@zelenomeds.com',     hash: '3667b34cd46b6689c4f8ea31284aec8f7dfd64796bc640887241250a7976f5f5', papel: 'vendedor' },
  { email: 'ana.beatriz@zelenomeds.com',        hash: '8e929c9cc600fc2d0b0a75452dd85f8e429a94f8f94cd874b84abfe58053856d', papel: 'vendedor' },
  { email: 'paulo.sousa@zelenomeds.com',        hash: '80aa217a44b242c8166fb25976ad99ea3cc9489512a368cb9059c4c01bf40c27', papel: 'vendedor' },
  { email: 'rogerio.chiaparini@zelenomeds.com', hash: '0f45d9ed554066f5545812625fcc4b7f59e59da8df35fb9aeb9d18853977f8e6', papel: 'vendedor' },
  { email: 'danilo.viegas@zelenomeds.com',      hash: '7a198a2be41e25ac6eacbb0a213d17b0a92e6de5729d8302d2e46a840df9eb6b', papel: 'vendedor' },
  { email: 'bruno.neves@zelenomeds.com',        hash: '2dcbf5fa0b389f9935e4730fdd132144ee226be259791b4deca577a909c5a51b', papel: 'vendedor' },
  { email: 'danilo.rabelo@zelenomeds.com',      hash: '0a54f83a53abab14f4ba5b71d8cf0d8e78e9295f858d1b822c0f4042d894b36d', papel: 'vendedor' },
  { email: 'giovanna.marinho@zelenomeds.com',   hash: '39cef6e6924ecf06d3537c1ae29b3d7fa5096787bdea3470aa4c120b3d21188b', papel: 'vendedor' },
  { email: 'valdez.silva@zelenomeds.com',       hash: '3d5f251263af7b551ffa7aeefc6693a8a5599cea36c775f632ba3789126f58af', papel: 'vendedor' },
  { email: 'carlos@zelenomeds.com',             hash: '821cd0ef2d1b9a9dba5e4cc7f4c7fd59196307646a84458cdf4a246aad06d8a6', papel: 'vendedor' },
  { email: 'marina.saad@zelenomeds.com',        hash: 'c8eade2b3a9875bcf28b82a18618a49b8b89d9f58231bf4694cc79138c6991b6', papel: 'vendedor' },
  { email: 'guilherme.gil@zelenomeds.com',      hash: '24ec21d2f21002fb678222ef9f5903ad16838622dede671eec1e4e610186ac2f', papel: 'vendedor' },
  { email: 'leonardo.pagani@zelenomeds.com',    hash: '3e86df4c8caef3e13ac5db2d38a0d8e56105966b5213802ef3ed19d1e7286cd2', papel: 'vendedor' },
  { email: 'luana.ereio@zelenomeds.com',        hash: 'bd6a3a12230da1546e71c238a58cdf17270234e996aec90eff101e94b940696d', papel: 'admin' },
  { email: 'laysla@zelenomeds.com',             hash: 'c829a2eac18f84e9f97c8e26315b66aa2b72a5dd9875314209db2e75ebc1142d', papel: 'admin' },
];

// ---------- CONFIG (variáveis de ambiente na Vercel) ----------
const CFG = {
  token: process.env.HUBSPOT_TOKEN || '',
  sessaoSecret: process.env.SESSAO_SECRET || '',
  // Pipeline de vendas e recompra + etapa "Em Tratativa - Orçamento enviado"
  pipeline: process.env.PIPELINE_ID || '799744057',
  etapaOrcamento: process.env.ETAPA_ORCAMENTO || '1173938947',
  propCpf: process.env.HUBSPOT_PROP_CPF || 'cpf_',
  // Se quiser marcar a Origem dos negócios criados aqui, defina ORIGEM_VALOR na Vercel (ex.: "Vendedor")
  origemValor: process.env.ORIGEM_VALOR || '',
  sessaoHoras: 12,
};

// ---------- SESSÃO (cookie assinado, mesmo esquema do painel da Rafaela) ----------
function b64u(buf) { return Buffer.from(buf).toString('base64url'); }
function assinar(dados) {
  const corpo = b64u(JSON.stringify(dados));
  const mac = crypto.createHmac('sha256', CFG.sessaoSecret).update(corpo).digest('base64url');
  return corpo + '.' + mac;
}
function verificar(token) {
  if (!token || !CFG.sessaoSecret) return null;
  const [corpo, mac] = String(token).split('.');
  if (!corpo || !mac) return null;
  const esperado = crypto.createHmac('sha256', CFG.sessaoSecret).update(corpo).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.exp || Date.now() > dados.exp) return null;
    return dados;
  } catch { return null; }
}
function lerCookie(req, nome) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + nome + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function sessaoDoRequest(req) {
  return verificar(lerCookie(req, 'zln_sessao'));
}
function setCookieSessao(res, dados) {
  const exp = Date.now() + CFG.sessaoHoras * 3600 * 1000;
  const token = assinar({ ...dados, exp });
  res.setHeader('Set-Cookie',
    `zln_sessao=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${CFG.sessaoHoras * 3600}`);
}
function limparCookieSessao(res) {
  res.setHeader('Set-Cookie', 'zln_sessao=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

// ---------- HUBSPOT ----------
async function hs(caminho, opts = {}) {
  const r = await fetch('https://api.hubapi.com' + caminho, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + CFG.token,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* deixa null */ }
  if (!r.ok) {
    const msg = (json && (json.message || json.error)) || texto || ('HTTP ' + r.status);
    const err = new Error('HubSpot: ' + msg);
    err.status = r.status;
    throw err;
  }
  return json;
}

// Descobre o owner do HubSpot pelo e-mail (com cache em memória)
const cacheOwners = { quando: 0, porEmail: null };
async function ownerPorEmail(email) {
  const agora = Date.now();
  if (!cacheOwners.porEmail || agora - cacheOwners.quando > 10 * 60 * 1000) {
    const mapa = {};
    let after = '';
    do {
      const pag = await hs('/crm/v3/owners?limit=100' + (after ? '&after=' + after : ''));
      for (const o of (pag.results || [])) {
        if (o.email) mapa[o.email.toLowerCase()] = { id: String(o.id), nome: [o.firstName, o.lastName].filter(Boolean).join(' ') };
      }
      after = pag.paging?.next?.after || '';
    } while (after);
    cacheOwners.porEmail = mapa;
    cacheOwners.quando = agora;
  }
  return cacheOwners.porEmail[String(email).toLowerCase()] || null;
}

// ---------- respostas ----------
function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}
async function lerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const partes = [];
  for await (const p of req) partes.push(p);
  try { return JSON.parse(Buffer.concat(partes).toString() || '{}'); } catch { return {}; }
}


// ---------- CATÁLOGO DE PRODUTOS (Status + Grupo de Liberação) ----------
function normTexto(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

let cachePropsProduto = { quando: 0, dados: null };
async function propsProduto() {
  const agora = Date.now();
  if (cachePropsProduto.dados && agora - cachePropsProduto.quando < 30 * 60 * 1000) return cachePropsProduto.dados;
  let propStatus = (process.env.PROP_STATUS_PRODUTO || '').trim();
  let propGrupo = (process.env.PROP_GRUPO_LIBERACAO || '').trim();
  if (!propStatus || !propGrupo) {
    const r = await hs('/crm/v3/properties/products');
    for (const p of (r.results || [])) {
      const rot = normTexto(p.label);
      if (!propStatus && rot === 'status') propStatus = p.name;
      if (!propGrupo && rot.includes('grupo') && rot.includes('libera')) propGrupo = p.name;
    }
    if (!propStatus) for (const p of (r.results || [])) { if (normTexto(p.label).includes('status')) { propStatus = p.name; break; } }
  }
  cachePropsProduto = { quando: agora, dados: { propStatus, propGrupo } };
  return cachePropsProduto.dados;
}

// Catálogo completo com categoria/dominância derivadas do Grupo de Liberação
// (ex.: ACAMP_FLOR_THC → flor THC) e gramas por unidade extraídas do nome.
let cacheCatalogo = { quando: 0, dados: null };
async function catalogoProdutos() {
  const agora = Date.now();
  if (cacheCatalogo.dados && agora - cacheCatalogo.quando < 10 * 60 * 1000) return cacheCatalogo.dados;
  const { propStatus, propGrupo } = await propsProduto();
  const propriedades = ['name', 'price', 'description', 'hs_sku', 'hs_images'];
  if (propStatus) propriedades.push(propStatus);
  if (propGrupo) propriedades.push(propGrupo);
  const produtos = [];
  let after = '';
  do {
    const pag = await hs('/crm/v3/objects/products?limit=100&archived=false&properties=' + propriedades.join(',') + (after ? '&after=' + after : ''));
    for (const pr of (pag.results || [])) {
      const p = pr.properties || {};
      const preco = parseFloat(p.price);
      const grupo = String(propGrupo ? (p[propGrupo] || '') : '').toUpperCase().trim();
      const statusVal = normTexto(propStatus ? (p[propStatus] || '') : '');
      const mg = String(p.name || '').match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
      produtos.push({
        id: String(pr.id),
        nome: p.name || '(sem nome)',
        preco: isNaN(preco) ? 0 : preco,
        sku: p.hs_sku || '',
        descricao: p.description || '',
        foto: (p.hs_images || '').split(';')[0].trim(),
        ativo: propStatus ? statusVal === 'ativo' : true, // só Status = Ativo aparece
        grupo,
        categoria: grupo.includes('FLOR') ? 'flor' : grupo.includes('EXTRATO') ? 'extrato' : grupo.includes('OLEO') ? 'oleo' : null,
        dominancia: grupo.includes('_CBD') ? 'CBD' : grupo.includes('_THC') ? 'THC' : null,
        gramas: mg ? parseFloat(mg[1].replace(',', '.')) : 5,
      });
    }
    after = pag.paging?.next?.after || '';
  } while (after);
  produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  cacheCatalogo = { quando: agora, dados: { produtos, propStatus, propGrupo } };
  return cacheCatalogo.dados;
}

// ---------- CASAMENTO RECEITA × CATÁLOGO (regra fixa, sem adivinhação) ----------
// Recebe os itens extraídos da receita pela IA e o catálogo, e decide o que
// está liberado e os limites de gramas por grupo.
function casarReceita(itensReceita, produtos) {
  const normDom = d => {
    d = String(d || '').toUpperCase();
    if (d.includes('CBD') && d.includes('THC')) return 'BAL';
    if (d.includes('BALANC')) return 'BAL';
    if (d.includes('CBD')) return 'CBD';
    if (d.includes('THC')) return 'THC';
    return null; // não especificada na receita
  };
  const normCat = c => {
    c = normTexto(c);
    if (c.includes('flor') || c.includes('inflor') || c.includes('bud')) return 'flor';
    if (c.includes('extrat') || c.includes('resin') || c.includes('rosin') || c.includes('hash') || c.includes('concentr')) return 'extrato';
    if (c.includes('oleo') || c.includes('oil')) return 'oleo';
    if (c.includes('comest') || c.includes('gummy') || c.includes('gomas')) return 'comestivel';
    return c || null;
  };
  const itens = (itensReceita || [])
    .map(i => ({
      descricao: i.descricao || '',
      cat: normCat(i.categoria),
      dom: normDom(i.dominancia),
      gramas: (i.gramas === null || i.gramas === undefined || i.gramas === '') ? null : Number(i.gramas),
      periodo: i.periodo || '',
    }))
    .filter(i => i.cat);

  const grupos = {};
  for (const i of itens) {
    const chave = i.cat + '-' + (i.dom || 'any');
    const nomeCat = i.cat === 'flor' ? 'Flores' : i.cat === 'extrato' ? 'Extratos' : i.cat === 'oleo' ? 'Óleos' : i.cat;
    const g = { chave, descricao: nomeCat + (i.dom && i.dom !== 'BAL' ? ' ' + i.dom : ''), gramas: i.gramas, periodo: i.periodo };
    const atual = grupos[chave];
    // com itens repetidos (mais de uma receita), vale o limite maior; sem limite (null) vence
    if (!atual) grupos[chave] = g;
    else if (atual.gramas !== null && (g.gramas === null || g.gramas > atual.gramas)) grupos[chave] = g;
  }

  const liberados = [];
  for (const p of produtos) {
    if (!p.categoria) continue; // produto sem Grupo de Liberação preenchido: não libera
    const item = itens.find(i =>
      i.cat === p.categoria &&
      (!i.dom || i.dom === 'BAL' || !p.dominancia || i.dom === p.dominancia)
    );
    if (item) {
      liberados.push({
        id: p.id, nome: p.nome,
        motivo: item.descricao,
        grupo: item.cat + '-' + (item.dom || 'any'),
        gramasPorUnidade: p.gramas,
      });
    }
  }
  return { liberados, grupos: Object.values(grupos) };
}

module.exports = { USUARIOS, CFG, crypto, sessaoDoRequest, setCookieSessao, limparCookieSessao, hs, ownerPorEmail, json, lerBody, catalogoProdutos, casarReceita };
