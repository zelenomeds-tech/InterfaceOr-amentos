const { json } = require('./_lib.js');

// GET /api/oauth?code=...
// Finaliza a INSTALAÇÃO do app "Orçamento Zeleno" na conta do HubSpot.
// O HubSpot redireciona para cá depois do clique em "Conectar app"; nós
// trocamos o código pela confirmação e pronto — nenhum token é guardado,
// o app só existe para exibir o cartão no negócio.
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const code = url.searchParams.get('code') || '';

  const clientId = (process.env.HS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.HS_CLIENT_SECRET || '').trim();
  const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);

  const pagina = (titulo, corpo, ok) => {
    res.statusCode = ok ? 200 : 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>body{font-family:system-ui;background:#123B2A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.c{background:#fff;color:#17201B;border-radius:16px;padding:36px;max-width:460px;text-align:center;box-shadow:0 30px 60px rgba(0,0,0,.4)}
h1{font-size:20px;color:#123B2A}p{color:#5C6B62;line-height:1.5}</style></head>
<body><div class="c"><h1>${titulo}</h1><p>${corpo}</p></div></body></html>`);
  };

  if (!clientId || !clientSecret) {
    return pagina('Faltam variáveis', 'Crie HS_CLIENT_ID e HS_CLIENT_SECRET na Vercel (com o Client ID e o Client secret da aba Auth do app) e faça Redeploy.', false);
  }
  if (!code) {
    return pagina('Link incompleto', 'Abra a instalação pelo link de autorização do app (com o code do HubSpot).', false);
  }

  try {
    const r = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: base + '/api/oauth',
        code,
      }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      return pagina('Não instalou', 'O HubSpot recusou: ' + (corpo.message || JSON.stringify(corpo)).slice(0, 300), false);
    }
    return pagina('✅ App instalado!', 'O cartão "Orçamento Zeleno" já pode aparecer nos negócios. Abra um negócio no HubSpot, dê F5 e use Personalizar registro para posicionar o cartão abaixo de "Orçamentos".', true);
  } catch (e) {
    return pagina('Erro', e.message, false);
  }
};
