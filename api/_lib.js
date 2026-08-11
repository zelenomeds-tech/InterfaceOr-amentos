// ============================================================
// ORÇAMENTO ZELENO — biblioteca compartilhada do backend
// (arquivos que começam com "_" não viram rota na Vercel)
// ============================================================
const crypto = require('crypto');

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
    `zln_sessao=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${CFG.sessaoHoras * 3600}`);
}
function limparCookieSessao(res) {
  res.setHeader('Set-Cookie', 'zln_sessao=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0');
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
  let propCategoria = (process.env.PROP_CATEGORIA_PRODUTO || '').trim();
  let valorAtivo = (process.env.VALOR_STATUS_ATIVO || '').trim();
  const r = await hs('/crm/v3/properties/products');
  const todas = r.results || [];

  // Status: entre as propriedades com "status" no nome, vale a que TEM a
  // opção "Ativo" dentro dela — assim não confunde com outra propriedade
  // parecida que exista vazia.
  const ehRotuloAtivo = rot => (rot.includes('ativo') && !rot.includes('inativo')) || (rot.includes('active') && !rot.includes('inactive'));
  const temOpcaoAtivo = p => ((p.options || []).some(o => ehRotuloAtivo(normTexto(o.label))));
  if (!propStatus) {
    const candidatas = todas.filter(p => normTexto(p.label).includes('status'));
    const comAtivo = candidatas.find(temOpcaoAtivo);
    const exata = candidatas.find(p => normTexto(p.label) === 'status');
    propStatus = (comAtivo || exata || candidatas[0] || {}).name || '';
  }
  if (!propGrupo) {
    const g = todas.find(p => normTexto(p.label).includes('grupo') && normTexto(p.label).includes('libera'));
    propGrupo = (g || {}).name || '';
  }
  if (!propCategoria) {
    const c = todas.find(p => normTexto(p.label) === 'categoria') || todas.find(p => normTexto(p.label).includes('categoria'));
    propCategoria = (c || {}).name || '';
  }
  // rótulos das opções da Categoria (o valor interno pode diferir do rótulo)
  const rotulosCategoria = {};
  if (propCategoria) {
    const pc = todas.find(x => x.name === propCategoria);
    for (const o of ((pc && pc.options) || [])) rotulosCategoria[String(o.value)] = o.label;
  }
  if (propStatus && !valorAtivo) {
    const p = todas.find(x => x.name === propStatus);
    const op = ((p && p.options) || []).find(o => ehRotuloAtivo(normTexto(o.label)));
    valorAtivo = op ? String(op.value) : 'ativo';
  }
  // para o diagnóstico: todas as candidatas com suas opções
  const candidatasStatus = todas
    .filter(p => normTexto(p.label).includes('status'))
    .map(p => ({ nomeInterno: p.name, rotulo: p.label, opcoes: (p.options || []).map(o => o.label) }));
  cachePropsProduto = { quando: agora, dados: { propStatus, propGrupo, propCategoria, rotulosCategoria, valorAtivo, candidatasStatus } };
  return cachePropsProduto.dados;
}

// Catálogo completo com categoria/dominância derivadas do Grupo de Liberação
// (ex.: ACAMP_FLOR_THC → flor THC) e gramas por unidade extraídas do nome.
let cacheCatalogo = { quando: 0, dados: null };
async function catalogoProdutos() {
  const agora = Date.now();
  if (cacheCatalogo.dados && agora - cacheCatalogo.quando < 10 * 60 * 1000) return cacheCatalogo.dados;
  const { propStatus, propGrupo, propCategoria, rotulosCategoria, valorAtivo } = await propsProduto();
  const propriedades = ['name', 'price', 'description', 'hs_sku', 'hs_images'];
  if (propStatus) propriedades.push(propStatus);
  if (propGrupo) propriedades.push(propGrupo);
  if (propCategoria) propriedades.push(propCategoria);
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
        statusBruto: propStatus ? String(p[propStatus] || '') : '',
        // ativo se bater com o valor interno da opção Ativo OU com o texto "ativo"
        ativo: propStatus ? (String(p[propStatus] || '') === valorAtivo || statusVal === 'ativo' || statusVal === 'active') : true,
        grupo,
        categoria: grupo.includes('FLOR') ? 'flor' : grupo.includes('EXTRATO') ? 'extrato' : grupo.includes('OLEO') ? 'oleo' : null,
        dominancia: grupo.includes('_CBD') ? 'CBD' : grupo.includes('_THC') ? 'THC' : null,
        gramas: mg ? parseFloat(mg[1].replace(',', '.')) : 5,
        categoriaLoja: propCategoria ? (rotulosCategoria[String(p[propCategoria] || '')] || String(p[propCategoria] || '')) : '',
      });
    }
    after = pag.paging?.next?.after || '';
  } while (after);
  produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  cacheCatalogo = { quando: agora, dados: { produtos, propStatus, propGrupo, valorAtivo, candidatasStatus: (await propsProduto()).candidatasStatus } };
  return cacheCatalogo.dados;
}

// ---------- PRODUTOS VENDÁVEIS ----------
// ⚠️ FILTRO DE NOME: por decisão da operação, o painel só mostra produtos
// cujo nome contém "anova" (tem itens Ativos no HubSpot que não podem ser
// desativados lá). Para mudar sem código: variável FILTRO_NOME_PRODUTO na
// Vercel — outro texto filtra por ele; o valor "todos" desliga o filtro.
function produtosVendaveis(produtos) {
  const filtro = normTexto((process.env.FILTRO_NOME_PRODUTO || 'anova').trim());
  const ativos = produtos.filter(p => p.ativo);
  if (!filtro || filtro === 'todos') return ativos;
  return ativos.filter(p => normTexto(p.nome).includes(filtro));
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

module.exports = { CFG, crypto, sessaoDoRequest, setCookieSessao, limparCookieSessao, hs, json, lerBody, catalogoProdutos, casarReceita, produtosVendaveis };
