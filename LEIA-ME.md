# Orçamentos Zeleno

Interface para os vendedores gerarem orçamento sem usar o HubSpot direto.

## Fluxo do vendedor

1. **Login** com o e-mail `@zelenomeds.com` e a senha `Zln-...`.
   `luana.ereio@` e `laysla@` entram como **admin** (veem tudo); os demais só
   veem os próprios clientes e negócios.
2. **Cliente** — busca por nome, e-mail, CPF ou **ID do registro** (aceita ID
   de contato ou de negócio). Tocando no cliente, abrem **os negócios dele**;
   o vendedor escolhe qual recebe o orçamento. Negócios já pagos/enviados/
   entregues aparecem travados (mover um pedido pago de volta para orçamento
   bagunçaria o funil).
3. **Produtos** — fotos e preços da biblioteca do HubSpot, com quantidade.
4. **Revisão** — o **CEP** vem do cadastro (editável) e é validado no ViaCEP:
   cidade de São Paulo marca **Entrega SP capital**, o resto marca **Sedex**
   (valores em `const FRETES` no `index.html`, marcado com ⚠️). Campo de
   desconto em R$.
5. **Gerar** — faz tudo de uma vez no negócio escolhido:
   - move para a etapa **"Em Tratativa - Orçamento enviado"** e atualiza o valor;
   - **substitui** os itens de linha do negócio pelos do orçamento
     (produtos com `hs_product_id`, frete com a modalidade no nome, desconto
     negativo) — substituir evita duplicar quando regera;
   - cria o **orçamento nativo** no quadro "Orçamentos" do negócio, no modelo
     da conta, já **publicado** com link para o cliente (validade 7 dias);
   - abre o **documento Zeleno** (cabeçalho, dados do cliente, produtos com
     foto, totais) pronto para Salvar PDF / Imprimir, com botão para abrir o
     link do orçamento do HubSpot.

## Instalação

1. Suba a pasta num repositório do GitHub. A pasta `api/` precisa manter a
   estrutura (arraste a pasta inteira; "choose files" achata tudo na raiz).
2. Vercel: Add New → Project → importe o repositório. Framework: *Other*.
3. Settings → Environment Variables:

   | Variável | Valor |
   |---|---|
   | `HUBSPOT_TOKEN` | token do app privado (`pat-na1-...`) |
   | `SESSAO_SECRET` | texto longo e aleatório qualquer |
   | `MODELO_ORCAMENTO_ID` | id do modelo "Orçamento Zeleno Foto" (`565494573213`) |

   Opcionais (só crie para mudar o padrão): `PIPELINE_ID` (799744057) ·
   `ETAPA_ORCAMENTO` (1173938947) · `ETAPAS_LISTA` (ids das etapas em que dá
   para lançar orçamento, separados por vírgula) · `HUBSPOT_PROP_CPF` (`cpf_`)
   · `ORIGEM_VALOR` (vazio).

4. ⚠️ Depois de salvar variáveis, **Redeploy** (Deployments → ⋯ → Redeploy).
5. Confira em `https://SEU-PROJETO.vercel.app/api/diagnostico`: variáveis,
   conexão, etapa configurada, os 18 e-mails com `existeNoHubSpot`, e os
   `modelosOrcamento` com o `modeloEmUso`.

Escopos do token: contatos (read), negócios (read/write), itens de linha
(read/write), produtos (read), owners (read) e **orçamentos/quotes
(read/write)**.

## Senhas

Só o hash SHA-256 fica no código (`api/_lib.js`). Para trocar uma senha:

```
node -e "console.log(require('crypto').createHash('sha256').update('NOVA-SENHA').digest('hex'))"
```

e substitua o hash da pessoa.

## Logo no documento

Procure o comentário `⚠️ LOGO` no `index.html` e troque o SVG+texto pela tag
`<img>` com a URL da logomarca.
