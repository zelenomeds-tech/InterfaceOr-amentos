<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Orçamentos · Zeleno</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ============================================================
   ORÇAMENTOS ZELENO — tokens
   ============================================================ */
:root{
  --mata:#123B2A;        /* verde profundo da marca */
  --mata-2:#0C2B1E;
  --folha:#2E7D5B;       /* verde de ação */
  --folha-escura:#22624735;
  --brotinho:#DCEEE2;    /* verde-claro de apoio */
  --papel:#F6F8F4;       /* fundo do app */
  --branco:#FFFFFF;
  --tinta:#17201B;
  --tinta-2:#5C6B62;
  --linha:#E2E8E0;
  --erro:#B3402E;
  --raio:14px;
  --sombra:0 10px 30px rgba(18,59,42,.10);
  --display:'Bricolage Grotesque',sans-serif;
  --texto:'Inter',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:var(--texto);background:var(--papel);color:var(--tinta);min-height:100dvh}
button{font-family:inherit;cursor:pointer}
input{font-family:inherit}
img{display:block}
.escondido{display:none!important}

/* ---------- LOGIN ---------- */
#telaLogin{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(1200px 700px at 70% -10%, #1B573E 0%, var(--mata) 45%, var(--mata-2) 100%)}
.cartaoLogin{width:100%;max-width:400px;background:var(--branco);border-radius:20px;box-shadow:0 30px 60px rgba(0,0,0,.35);padding:36px 32px}
.marca{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:6px}
.marca svg{width:26px;height:26px}
.marca b{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:.06em;color:var(--mata)}
.cartaoLogin .sub{text-align:center;color:var(--tinta-2);font-size:14px;margin-bottom:28px}
.campo{margin-bottom:14px}
.campo label{display:block;font-size:12px;font-weight:600;color:var(--tinta-2);letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}
.campo input{width:100%;border:1.5px solid var(--linha);border-radius:10px;padding:12px 14px;font-size:16px;background:#FDFDFC;transition:border-color .15s}
.campo input:focus{outline:none;border-color:var(--folha)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;
  padding:13px 22px;font-size:15px;font-weight:700;transition:transform .1s ease, opacity .15s}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.55;cursor:default}
.btn-verde{background:var(--folha);color:#fff;width:100%}
.btn-verde:hover{background:#276E50}
.btn-fantasma{background:transparent;color:var(--folha);border:1.5px solid var(--folha)}
.btn-claro{background:var(--brotinho);color:var(--mata)}
.msgErro{background:#FBEDEA;color:var(--erro);border-radius:10px;padding:10px 12px;font-size:14px;margin-top:12px}

/* ---------- APP ---------- */
#app{display:flex;flex-direction:column;min-height:100dvh}
.topo{background:var(--mata);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:30}
.topo .marca b{color:#fff;font-size:19px}
.topo .marca svg path{fill:#8FCBA9}
.topo .quem{margin-left:auto;text-align:right;line-height:1.25}
.topo .quem b{font-size:14px;display:block}
.topo .quem button{background:none;border:none;color:#9FC6B1;font-size:12px;padding:0;text-decoration:underline}

.passos{display:flex;gap:6px;padding:14px 20px 0;max-width:980px;width:100%;margin:0 auto}
.passo{flex:1;background:var(--branco);border:1.5px solid var(--linha);border-radius:999px;padding:9px 8px;
  font-size:13px;font-weight:600;color:var(--tinta-2);text-align:center;transition:.2s}
.passo.ativo{border-color:var(--folha);color:var(--mata);background:var(--brotinho)}
.passo.feito{color:var(--folha)}
.passo .num{display:inline-flex;width:19px;height:19px;border-radius:50%;background:var(--linha);color:var(--tinta-2);
  align-items:center;justify-content:center;font-size:11px;margin-right:6px;vertical-align:-3px}
.passo.ativo .num{background:var(--folha);color:#fff}
.passo.feito .num{background:var(--folha);color:#fff}

.conteudo{flex:1;max-width:980px;width:100%;margin:0 auto;padding:18px 20px 120px}
.tituloSecao{font-family:var(--display);font-weight:700;font-size:22px;color:var(--mata);margin:8px 0 4px}
.subSecao{color:var(--tinta-2);font-size:14px;margin-bottom:16px}

.buscaLinha{position:relative;margin-bottom:14px}
.buscaLinha input{width:100%;border:1.5px solid var(--linha);border-radius:12px;padding:13px 14px 13px 42px;font-size:16px;background:var(--branco)}
.buscaLinha input:focus{outline:none;border-color:var(--folha)}
.buscaLinha svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;opacity:.45}

/* clientes */
.listaClientes{display:flex;flex-direction:column;gap:8px}
.cliente{background:var(--branco);border:1.5px solid var(--linha);border-radius:var(--raio);padding:13px 15px;
  display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s}
.cliente:hover{border-color:var(--folha)}
.cliente.sel{border-color:var(--folha);background:var(--brotinho)}
.cliente .inicial{width:38px;height:38px;border-radius:50%;background:var(--brotinho);color:var(--mata);
  display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.cliente.sel .inicial{background:var(--folha);color:#fff}
.cliente .info{min-width:0}
.cliente .info b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cliente .info span{font-size:13px;color:var(--tinta-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}

.fichaCliente{background:var(--branco);border:1.5px solid var(--linha);border-radius:var(--raio);padding:18px;margin-top:16px}
.fichaCliente h3{font-family:var(--display);font-size:16px;color:var(--mata);margin-bottom:12px}
.gradeFicha{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:560px){.gradeFicha{grid-template-columns:1fr}}

/* produtos */
.gradeProdutos{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.prod{background:var(--branco);border:1.5px solid var(--linha);border-radius:var(--raio);overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s}
.prod.noCarrinho{border-color:var(--folha)}
.prod .foto{aspect-ratio:1/1;background:#F0F3EE;display:flex;align-items:center;justify-content:center;overflow:hidden}
.prod .foto img{width:100%;height:100%;object-fit:cover}
.prod .foto .semFoto{color:#B7C4BB}
.prod .corpo{padding:12px 13px 13px;display:flex;flex-direction:column;gap:8px;flex:1}
.prod .nome{font-size:14px;font-weight:600;line-height:1.3;flex:1}
.prod .preco{font-family:var(--display);font-weight:700;font-size:16px;color:var(--mata)}
.stepper{display:flex;align-items:center;justify-content:space-between;border:1.5px solid var(--linha);border-radius:10px;overflow:hidden}
.stepper button{width:40px;height:38px;border:none;background:var(--brotinho);color:var(--mata);font-size:18px;font-weight:700}
.stepper button:disabled{opacity:.4}
.stepper .qtd{font-weight:700;font-size:15px}
.btnAdd{border:1.5px solid var(--folha);background:var(--branco);color:var(--folha);border-radius:10px;height:38px;font-weight:700;font-size:14px}
.btnAdd:hover{background:var(--brotinho)}

/* barra do total (assinatura do app: cupom fixo embaixo) */
.cupom{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--branco);border-top:1.5px solid var(--linha);
  box-shadow:0 -12px 30px rgba(18,59,42,.10);padding:12px 20px calc(12px + env(safe-area-inset-bottom))}
.cupom .dentro{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:14px}
.cupom .resumo{line-height:1.2}
.cupom .resumo span{font-size:12px;color:var(--tinta-2);display:block}
.cupom .resumo b{font-family:var(--display);font-size:20px;color:var(--mata)}
.cupom .btn{margin-left:auto}

/* revisão */
.itemRev{display:flex;align-items:center;gap:12px;background:var(--branco);border:1.5px solid var(--linha);border-radius:var(--raio);padding:10px 12px;margin-bottom:8px}
.itemRev img,.itemRev .miniSem{width:52px;height:52px;border-radius:10px;object-fit:cover;background:#F0F3EE;flex-shrink:0}
.itemRev .miniSem{display:flex;align-items:center;justify-content:center;color:#B7C4BB}
.itemRev .meio{flex:1;min-width:0}
.itemRev .meio b{font-size:14px;display:block}
.itemRev .meio span{font-size:13px;color:var(--tinta-2)}
.itemRev .valor{font-weight:700;font-size:14px;white-space:nowrap}
.itemRev .tirar{background:none;border:none;color:var(--tinta-2);font-size:18px;padding:4px}
.ajustes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
@media(max-width:560px){.ajustes{grid-template-columns:1fr}}
.caixaTotais{background:var(--mata);color:#fff;border-radius:var(--raio);padding:18px;margin-top:8px}
.caixaTotais .li{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;color:#CFE3D7}
.caixaTotais .li.total{border-top:1px solid #ffffff2b;margin-top:8px;padding-top:12px;color:#fff;font-size:16px}
.caixaTotais .li.total b{font-family:var(--display);font-size:24px}

.rodapeAcoes{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.rodapeAcoes .btn{flex:1;min-width:180px}

.carregando{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--tinta-2);padding:40px 0;font-size:14px}
.aro{width:18px;height:18px;border:2.5px solid var(--linha);border-top-color:var(--folha);border-radius:50%;animation:gira .8s linear infinite}
@keyframes gira{to{transform:rotate(360deg)}}
.vazio{text-align:center;color:var(--tinta-2);padding:40px 12px;font-size:14px}

/* ============================================================
   DOCUMENTO DO ORÇAMENTO (visual de folha A4)
   ============================================================ */
#telaDoc{position:fixed;inset:0;z-index:60;background:#3A463F;overflow:auto;padding:22px 12px 120px}
.docBarra{position:fixed;left:0;right:0;bottom:0;z-index:70;background:var(--branco);border-top:1.5px solid var(--linha);
  padding:12px 20px calc(12px + env(safe-area-inset-bottom));display:flex;gap:10px;justify-content:center}
.docBarra .btn{min-width:170px}
.folha{background:#fff;max-width:760px;margin:0 auto;border-radius:6px;box-shadow:0 24px 60px rgba(0,0,0,.45);overflow:hidden}
.docCabeca{background:var(--mata);color:#fff;padding:30px 40px;display:flex;align-items:flex-start;gap:16px}
.docCabeca .marca{justify-content:flex-start;margin:0}
.docCabeca .marca b{color:#fff;font-size:28px}
.docCabeca .marca svg{width:30px;height:30px}
.docCabeca .marca svg path{fill:#8FCBA9}
.docCabeca .lado{margin-left:auto;text-align:right}
.docCabeca .selo{font-family:var(--display);font-weight:800;font-size:13px;letter-spacing:.28em;color:#8FCBA9}
.docCabeca .numero{font-family:var(--display);font-weight:700;font-size:20px;margin-top:2px}
.docCabeca .dataDoc{font-size:12px;color:#BFD9CB;margin-top:2px}
.docMiolo{padding:30px 40px 36px}
.docBloco{margin-bottom:24px}
.docRotulo{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--folha);margin-bottom:8px}
.docCliente{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:14px 18px;font-size:14px}
.docCliente span{color:var(--tinta-2);font-size:12px;display:block}
.docCliente b{font-weight:600}
table.docItens{width:100%;border-collapse:collapse;font-size:14px}
table.docItens th{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tinta-2);
  text-align:left;padding:0 8px 8px;border-bottom:1.5px solid var(--linha)}
table.docItens th.num, table.docItens td.num{text-align:right}
table.docItens td{padding:10px 8px;border-bottom:1px solid var(--linha);vertical-align:middle}
table.docItens .prodCel{display:flex;align-items:center;gap:12px}
table.docItens .prodCel img,.prodCel .miniSem{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#F0F3EE;flex-shrink:0}
.prodCel .miniSem{display:flex;align-items:center;justify-content:center;color:#B7C4BB}
.docTotais{margin-left:auto;width:280px;max-width:100%;margin-top:16px}
.docTotais .li{display:flex;justify-content:space-between;padding:5px 8px;font-size:14px;color:var(--tinta-2)}
.docTotais .li b{color:var(--tinta)}
.docTotais .liTotal{background:var(--mata);color:#fff;border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.docTotais .liTotal span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#BFD9CB}
.docTotais .liTotal b{font-family:var(--display);font-size:22px}
.docRodape{border-top:1.5px solid var(--linha);padding:16px 40px 26px;font-size:12px;color:var(--tinta-2);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:560px){
  .docCabeca{padding:22px 20px}
  .docMiolo{padding:22px 20px 28px}
  .docRodape{padding:14px 20px 22px}
  .docCliente{grid-template-columns:1fr}
}

/* impressão: só a folha */
@media print{
  body{background:#fff}
  body > *:not(#telaDoc){display:none!important}
  #telaDoc{position:static;background:#fff;padding:0;overflow:visible}
  .docBarra{display:none!important}
  .folha{box-shadow:none;border-radius:0;max-width:100%}
}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>

<!-- ==================== LOGIN ==================== -->
<div id="telaLogin">
  <div class="cartaoLogin">
    <div class="marca">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 7 5.5 10.5 5.5 14.5A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 10.5 16 7 12 2Zm0 17.2c-.3-2.6-.3-5.2 0-8 .3 2.8.3 5.4 0 8Z" fill="#123B2A"/></svg>
      <b>ZELENO</b>
    </div>
    <p class="sub">Gerador de orçamentos</p>
    <div class="campo">
      <label for="inEmail">E-mail</label>
      <input id="inEmail" type="email" autocomplete="username" placeholder="voce@zelenomeds.com" inputmode="email">
    </div>
    <div class="campo">
      <label for="inSenha">Senha</label>
      <input id="inSenha" type="password" autocomplete="current-password" placeholder="••••••••">
    </div>
    <button class="btn btn-verde" id="btnEntrar">Entrar</button>
    <div class="msgErro escondido" id="erroLogin"></div>
  </div>
</div>

<!-- ==================== APP ==================== -->
<div id="app" class="escondido">
  <div class="topo">
    <div class="marca">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 7 5.5 10.5 5.5 14.5A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 10.5 16 7 12 2Zm0 17.2c-.3-2.6-.3-5.2 0-8 .3 2.8.3 5.4 0 8Z" fill="#8FCBA9"/></svg>
      <b>ZELENO</b>
    </div>
    <div class="quem">
      <b id="nomeVendedor"></b>
      <button id="btnSair">sair</button>
    </div>
  </div>

  <div class="passos">
    <div class="passo ativo" data-passo="1"><span class="num">1</span>Cliente</div>
    <div class="passo" data-passo="2"><span class="num">2</span>Produtos</div>
    <div class="passo" data-passo="3"><span class="num">3</span>Revisão</div>
  </div>

  <!-- PASSO 1: CLIENTE -->
  <div class="conteudo" id="passoCliente">
    <h2 class="tituloSecao">Para quem é o orçamento?</h2>
    <p class="subSecao">Seus clientes do HubSpot. Toque para escolher.</p>
    <div class="buscaLinha">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="buscaCliente" type="search" placeholder="Buscar por nome, e-mail ou CPF">
    </div>
    <div id="listaClientes" class="listaClientes"><div class="carregando"><span class="aro"></span>Carregando seus clientes…</div></div>

    <div class="fichaCliente escondido" id="fichaCliente">
      <h3>Dados que saem no orçamento</h3>
      <div class="gradeFicha">
        <div class="campo"><label>Nome</label><input id="fNome"></div>
        <div class="campo"><label>CPF</label><input id="fCpf" inputmode="numeric"></div>
        <div class="campo"><label>E-mail</label><input id="fEmail" inputmode="email"></div>
        <div class="campo"><label>Telefone</label><input id="fTelefone" inputmode="tel"></div>
      </div>
    </div>
  </div>

  <!-- PASSO 2: PRODUTOS -->
  <div class="conteudo escondido" id="passoProdutos">
    <h2 class="tituloSecao">Produtos</h2>
    <p class="subSecao">Preços e fotos direto do HubSpot.</p>
    <div class="buscaLinha">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="buscaProduto" type="search" placeholder="Buscar produto">
    </div>
    <div id="gradeProdutos" class="gradeProdutos"><div class="carregando"><span class="aro"></span>Carregando produtos…</div></div>
  </div>

  <!-- PASSO 3: REVISÃO -->
  <div class="conteudo escondido" id="passoRevisao">
    <h2 class="tituloSecao">Revisão</h2>
    <p class="subSecao" id="revCliente"></p>
    <div id="listaRevisao"></div>

    <div class="ajustes">
      <div class="campo"><label>Frete (R$)</label><input id="inFrete" inputmode="decimal" placeholder="0,00"></div>
      <div class="campo"><label>Desconto (R$)</label><input id="inDesconto" inputmode="decimal" placeholder="0,00"></div>
    </div>

    <div class="caixaTotais">
      <div class="li"><span>Subtotal</span><span id="tSubtotal"></span></div>
      <div class="li"><span>Frete</span><span id="tFrete"></span></div>
      <div class="li"><span>Desconto</span><span id="tDesconto"></span></div>
      <div class="li total"><span>Total</span><b id="tTotal"></b></div>
    </div>

    <div class="rodapeAcoes">
      <button class="btn btn-fantasma" id="btnVoltarProdutos">Voltar aos produtos</button>
      <button class="btn btn-verde" id="btnGerar">Gerar orçamento</button>
    </div>
    <div class="msgErro escondido" id="erroGerar"></div>
  </div>

  <!-- CUPOM (barra fixa do total) -->
  <div class="cupom escondido" id="cupom">
    <div class="dentro">
      <div class="resumo"><span id="cupomItens"></span><b id="cupomTotal"></b></div>
      <button class="btn btn-verde" id="btnCupom">Continuar</button>
    </div>
  </div>
</div>

<!-- ==================== DOCUMENTO ==================== -->
<div id="telaDoc" class="escondido">
  <div class="folha" id="folhaDoc"><!-- preenchido pelo JS --></div>
  <div class="docBarra">
    <button class="btn btn-claro" id="btnNovoOrc">Novo orçamento</button>
    <button class="btn btn-verde" id="btnImprimir">Salvar PDF / Imprimir</button>
  </div>
</div>

<script>
// ============================================================
// ORÇAMENTOS ZELENO — front
// ============================================================
const $ = s => document.querySelector(s);
const brl = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const estado = {
  vendedor: null,
  clientes: [],
  clienteSel: null,
  produtos: [],
  carrinho: new Map(),  // produtoId -> quantidade
  passo: 1,
};

async function api(caminho, opts) {
  const r = await fetch(caminho, { credentials: 'same-origin', ...opts });
  const j = await r.json().catch(() => ({ ok:false, erro:'Resposta inválida do servidor' }));
  if (r.status === 401 && caminho !== '/api/login' && caminho !== '/api/sessao') { mostrarLogin(); }
  return j;
}

/* ---------- login ---------- */
function mostrarLogin(){ $('#telaLogin').classList.remove('escondido'); $('#app').classList.add('escondido'); }
function mostrarApp(){ $('#telaLogin').classList.add('escondido'); $('#app').classList.remove('escondido'); }

async function entrar() {
  const btn = $('#btnEntrar'); btn.disabled = true; btn.textContent = 'Entrando…';
  $('#erroLogin').classList.add('escondido');
  const j = await api('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: $('#inEmail').value, senha: $('#inSenha').value }),
  });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (!j.ok) { const e = $('#erroLogin'); e.textContent = j.erro || 'Não foi possível entrar'; e.classList.remove('escondido'); return; }
  iniciarApp(j);
}
$('#btnEntrar').addEventListener('click', entrar);
$('#inSenha').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });

$('#btnSair').addEventListener('click', async () => { await api('/api/sair', { method: 'POST' }); location.reload(); });

/* ---------- app ---------- */
function iniciarApp(sessao) {
  estado.vendedor = sessao;
  $('#nomeVendedor').textContent = sessao.nome || sessao.email;
  mostrarApp();
  irParaPasso(1);
  carregarClientes('');
  carregarProdutos();
}

function irParaPasso(n) {
  estado.passo = n;
  document.querySelectorAll('.passo').forEach(p => {
    const num = +p.dataset.passo;
    p.classList.toggle('ativo', num === n);
    p.classList.toggle('feito', num < n);
  });
  $('#passoCliente').classList.toggle('escondido', n !== 1);
  $('#passoProdutos').classList.toggle('escondido', n !== 2);
  $('#passoRevisao').classList.toggle('escondido', n !== 3);
  atualizarCupom();
  if (n === 3) montarRevisao();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.passo').forEach(p => p.addEventListener('click', () => {
  const n = +p.dataset.passo;
  if (n === 1) irParaPasso(1);
  if (n === 2 && estado.clienteSel) irParaPasso(2);
  if (n === 3 && estado.clienteSel && estado.carrinho.size) irParaPasso(3);
}));

/* ---------- clientes ---------- */
let timerBusca = null;
$('#buscaCliente').addEventListener('input', e => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(() => carregarClientes(e.target.value.trim()), 350);
});

async function carregarClientes(busca) {
  const lista = $('#listaClientes');
  lista.innerHTML = '<div class="carregando"><span class="aro"></span>Buscando…</div>';
  const j = await api('/api/clientes' + (busca ? '?busca=' + encodeURIComponent(busca) : ''));
  if (!j.ok) { lista.innerHTML = '<div class="vazio">' + escapeHtml(j.erro || 'Não foi possível carregar') + '</div>'; return; }
  estado.clientes = j.clientes;
  if (!j.clientes.length) { lista.innerHTML = '<div class="vazio">Nenhum cliente encontrado. Ajuste a busca.</div>'; return; }
  lista.innerHTML = j.clientes.map(c => `
    <div class="cliente ${estado.clienteSel && estado.clienteSel.id === c.id ? 'sel' : ''}" data-id="${c.id}">
      <div class="inicial">${escapeHtml((c.nome || '?').trim().charAt(0).toUpperCase())}</div>
      <div class="info"><b>${escapeHtml(c.nome)}</b><span>${escapeHtml([c.email, c.telefone].filter(Boolean).join(' · ') || 'sem contato cadastrado')}</span></div>
    </div>`).join('');
  lista.querySelectorAll('.cliente').forEach(el => el.addEventListener('click', () => escolherCliente(el.dataset.id)));
}

function escolherCliente(id) {
  const c = estado.clientes.find(x => x.id === id);
  if (!c) return;
  estado.clienteSel = c;
  document.querySelectorAll('.cliente').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
  $('#fichaCliente').classList.remove('escondido');
  $('#fNome').value = c.nome; $('#fCpf').value = c.cpf; $('#fEmail').value = c.email; $('#fTelefone').value = c.telefone;
  atualizarCupom();
  $('#fichaCliente').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- produtos ---------- */
async function carregarProdutos() {
  const j = await api('/api/produtos');
  const grade = $('#gradeProdutos');
  if (!j.ok) { grade.innerHTML = '<div class="vazio">' + escapeHtml(j.erro || 'Não foi possível carregar os produtos') + '</div>'; return; }
  estado.produtos = j.produtos;
  desenharProdutos('');
}
$('#buscaProduto').addEventListener('input', e => desenharProdutos(e.target.value.trim().toLowerCase()));

function desenharProdutos(filtro) {
  const grade = $('#gradeProdutos');
  const lista = estado.produtos.filter(p => !filtro || p.nome.toLowerCase().includes(filtro) || (p.sku||'').toLowerCase().includes(filtro));
  if (!lista.length) { grade.innerHTML = '<div class="vazio">Nenhum produto com esse nome.</div>'; return; }
  grade.innerHTML = lista.map(p => {
    const qtd = estado.carrinho.get(p.id) || 0;
    return `
    <div class="prod ${qtd ? 'noCarrinho' : ''}" data-id="${p.id}">
      <div class="foto">${p.foto ? `<img src="${escapeHtml(p.foto)}" alt="" loading="lazy" onerror="this.remove()">` : semFotoSvg()}</div>
      <div class="corpo">
        <div class="nome">${escapeHtml(p.nome)}</div>
        <div class="preco">${brl(p.preco)}</div>
        ${qtd
          ? `<div class="stepper"><button data-acao="menos">−</button><span class="qtd">${qtd}</span><button data-acao="mais">+</button></div>`
          : `<button class="btnAdd" data-acao="add">Adicionar</button>`}
      </div>
    </div>`;
  }).join('');
  grade.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', ev => {
    const id = ev.target.closest('.prod').dataset.id;
    const atual = estado.carrinho.get(id) || 0;
    const acao = ev.target.dataset.acao;
    if (acao === 'add' || acao === 'mais') estado.carrinho.set(id, atual + 1);
    if (acao === 'menos') { if (atual <= 1) estado.carrinho.delete(id); else estado.carrinho.set(id, atual - 1); }
    desenharProdutos(filtro);
    atualizarCupom();
  }));
}
function semFotoSvg(){ return '<svg class="semFoto" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L7 20"/></svg>'; }

/* ---------- cupom ---------- */
function totaisAtuais() {
  let subtotal = 0, qtdItens = 0;
  for (const [id, q] of estado.carrinho) {
    const p = estado.produtos.find(x => x.id === id);
    if (p) { subtotal += p.preco * q; qtdItens += q; }
  }
  const frete = lerValor($('#inFrete').value);
  const desconto = lerValor($('#inDesconto').value);
  const total = Math.max(0, subtotal + frete - desconto);
  return { subtotal, frete, desconto, total, qtdItens };
}
function lerValor(t){ const n = parseFloat(String(t||'').replace(/\./g,'').replace(',', '.')); return isNaN(n) ? 0 : Math.max(0, n); }

function atualizarCupom() {
  const cupom = $('#cupom');
  const { subtotal, qtdItens } = totaisAtuais();
  if (estado.passo === 1) {
    if (!estado.clienteSel) { cupom.classList.add('escondido'); return; }
    cupom.classList.remove('escondido');
    $('#cupomItens').textContent = 'Cliente escolhido';
    $('#cupomTotal').textContent = estado.clienteSel.nome.split(' ')[0];
    $('#btnCupom').textContent = 'Escolher produtos';
  } else if (estado.passo === 2) {
    if (!estado.carrinho.size) { cupom.classList.add('escondido'); return; }
    cupom.classList.remove('escondido');
    $('#cupomItens').textContent = qtdItens + (qtdItens === 1 ? ' item' : ' itens');
    $('#cupomTotal').textContent = brl(subtotal);
    $('#btnCupom').textContent = 'Revisar orçamento';
  } else {
    cupom.classList.add('escondido');
  }
}
$('#btnCupom').addEventListener('click', () => {
  if (estado.passo === 1) irParaPasso(2);
  else if (estado.passo === 2) irParaPasso(3);
});

/* ---------- revisão ---------- */
function montarRevisao() {
  const c = estado.clienteSel;
  $('#revCliente').textContent = 'Orçamento para ' + ($('#fNome').value || c.nome);
  const lista = $('#listaRevisao');
  const linhas = [];
  for (const [id, q] of estado.carrinho) {
    const p = estado.produtos.find(x => x.id === id);
    if (!p) continue;
    linhas.push(`
      <div class="itemRev" data-id="${p.id}">
        ${p.foto ? `<img src="${escapeHtml(p.foto)}" alt="" onerror="this.outerHTML=zSemMini()">` : `<div class="miniSem">${semFotoSvg()}</div>`}
        <div class="meio"><b>${escapeHtml(p.nome)}</b><span>${q} × ${brl(p.preco)}</span></div>
        <div class="valor">${brl(p.preco * q)}</div>
        <button class="tirar" title="Remover">✕</button>
      </div>`);
  }
  lista.innerHTML = linhas.join('');
  lista.querySelectorAll('.tirar').forEach(b => b.addEventListener('click', ev => {
    estado.carrinho.delete(ev.target.closest('.itemRev').dataset.id);
    if (!estado.carrinho.size) { irParaPasso(2); desenharProdutos(''); return; }
    montarRevisao();
  }));
  atualizarTotaisRevisao();
}
window.zSemMini = () => `<div class="miniSem">${semFotoSvg()}</div>`;

function atualizarTotaisRevisao() {
  const { subtotal, frete, desconto, total } = totaisAtuais();
  $('#tSubtotal').textContent = brl(subtotal);
  $('#tFrete').textContent = frete ? brl(frete) : '—';
  $('#tDesconto').textContent = desconto ? '− ' + brl(desconto) : '—';
  $('#tTotal').textContent = brl(total);
}
$('#inFrete').addEventListener('input', atualizarTotaisRevisao);
$('#inDesconto').addEventListener('input', atualizarTotaisRevisao);
$('#btnVoltarProdutos').addEventListener('click', () => irParaPasso(2));

/* ---------- gerar ---------- */
$('#btnGerar').addEventListener('click', async () => {
  const btn = $('#btnGerar');
  $('#erroGerar').classList.add('escondido');
  btn.disabled = true; btn.textContent = 'Gerando e lançando no HubSpot…';

  const itens = [];
  for (const [id, q] of estado.carrinho) {
    const p = estado.produtos.find(x => x.id === id);
    if (p) itens.push({ produtoId: p.id, nome: p.nome, preco: p.preco, quantidade: q, foto: p.foto });
  }
  const { frete, desconto } = totaisAtuais();

  const j = await api('/api/orcamento', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId: estado.clienteSel.id,
      clienteNome: $('#fNome').value || estado.clienteSel.nome,
      itens: itens.map(({foto, ...resto}) => resto),
      frete, desconto,
    }),
  });

  btn.disabled = false; btn.textContent = 'Gerar orçamento';
  if (!j.ok) { const e = $('#erroGerar'); e.textContent = j.erro || 'Não foi possível gerar'; e.classList.remove('escondido'); return; }

  abrirDocumento({
    numero: j.numero, data: j.data,
    cliente: { nome: $('#fNome').value, cpf: $('#fCpf').value, email: $('#fEmail').value, telefone: $('#fTelefone').value },
    itens,
    subtotal: j.subtotal, frete: j.frete, desconto: j.desconto, total: j.total,
    vendedor: estado.vendedor.nome,
  });
});

/* ---------- documento ---------- */
function abrirDocumento(d) {
  const linhas = d.itens.map(i => `
    <tr>
      <td><div class="prodCel">
        ${i.foto ? `<img src="${escapeHtml(i.foto)}" alt="" onerror="this.outerHTML=zSemMini()">` : `<div class="miniSem">${semFotoSvg()}</div>`}
        <span>${escapeHtml(i.nome)}</span>
      </div></td>
      <td class="num">${i.quantidade}</td>
      <td class="num">${brl(i.preco)}</td>
      <td class="num"><b>${brl(i.preco * i.quantidade)}</b></td>
    </tr>`).join('');

  $('#folhaDoc').innerHTML = `
    <div class="docCabeca">
      <div class="marca">
        <!-- ⚠️ LOGO: para usar a logomarca em imagem, troque este SVG+texto por
             <img src="URL-DA-LOGO" alt="Zeleno" style="height:34px"> -->
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 7 5.5 10.5 5.5 14.5A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 10.5 16 7 12 2Zm0 17.2c-.3-2.6-.3-5.2 0-8 .3 2.8.3 5.4 0 8Z"/></svg>
        <b>ZELENO</b>
      </div>
      <div class="lado">
        <div class="selo">ORÇAMENTO</div>
        <div class="numero">Nº ${escapeHtml(d.numero)}</div>
        <div class="dataDoc">${escapeHtml(d.data)} · Vendedor(a): ${escapeHtml(d.vendedor || '')}</div>
      </div>
    </div>
    <div class="docMiolo">
      <div class="docBloco">
        <div class="docRotulo">Cliente</div>
        <div class="docCliente">
          <div><span>Nome</span><b>${escapeHtml(d.cliente.nome || '—')}</b></div>
          <div><span>CPF</span><b>${escapeHtml(d.cliente.cpf || '—')}</b></div>
          <div><span>E-mail</span><b>${escapeHtml(d.cliente.email || '—')}</b></div>
          <div><span>Telefone</span><b>${escapeHtml(d.cliente.telefone || '—')}</b></div>
        </div>
      </div>
      <div class="docBloco">
        <div class="docRotulo">Produtos</div>
        <table class="docItens">
          <thead><tr><th>Produto</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Valor</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <div class="docTotais">
          <div class="li"><span>Subtotal</span><b>${brl(d.subtotal)}</b></div>
          ${d.frete ? `<div class="li"><span>Frete</span><b>${brl(d.frete)}</b></div>` : ''}
          ${d.desconto ? `<div class="li"><span>Desconto</span><b>− ${brl(d.desconto)}</b></div>` : ''}
          <div class="liTotal"><span>Total</span><b>${brl(d.total)}</b></div>
        </div>
      </div>
    </div>
    <div class="docRodape">
      <span>Zeleno · zelenostore.com</span>
      <span>Orçamento válido por 7 dias. Valores sujeitos a confirmação de estoque.</span>
    </div>`;
  $('#telaDoc').classList.remove('escondido');
}
$('#btnImprimir').addEventListener('click', () => window.print());
$('#btnNovoOrc').addEventListener('click', () => {
  $('#telaDoc').classList.add('escondido');
  estado.carrinho.clear();
  estado.clienteSel = null;
  $('#fichaCliente').classList.add('escondido');
  $('#inFrete').value = ''; $('#inDesconto').value = '';
  $('#buscaCliente').value = ''; $('#buscaProduto').value = '';
  desenharProdutos('');
  carregarClientes('');
  irParaPasso(1);
});

/* ---------- sessão ao abrir ---------- */
(async () => {
  const s = await api('/api/sessao');
  if (s.ok) iniciarApp(s);
})();
</script>
</body>
</html>
