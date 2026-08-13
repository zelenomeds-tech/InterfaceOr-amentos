# Interface de Orçamentos Zeleno — Documentação Técnica Completa

**Repositório:** `InterfaceOr-amentos` (org zelenomeds-tech) · **Deploy:** Vercel — `interface-or-amentos.vercel.app`
**Stack:** HTML/CSS/JS puro em arquivo único (`index.html`) + funções serverless Node.js (`api/`) + 2 fluxos n8n + HubSpot como fonte de dados.
**Tarefa:** LOJ-011 (interface de geração de orçamentos com travas de receita e documentação).

---

## 1. Visão geral do fluxo

```
HubSpot (negócio) ──link_orcamento──▶ index.html?negocio=ID&chave=CHAVE
                                          │
                                          ▼
                                   GET /api/abrir ── valida chave + etapa
                                          │          carrega cliente, vendedor,
                                          │          documentos, orçamentos anteriores
                                          │          e abre a sessão (cookie HMAC)
                                          ▼
                        ┌─── GET /api/produtos (catálogo vendável)
   TELA 1: PRODUTOS ────┤─── GET /api/receita ──▶ n8n (IA lê a receita)
   categorias → itens   │                          └─ casamento receita×catálogo
   desconto por item    │                             feito no servidor (regra fixa)
   frete (CEP→ViaCEP)   │
                        ▼
   TELA 2: REVISÃO (resumo) ──▶ POST /api/orcamento
                                  ├─ revalida receita, gramas, desconto 20%
                                  ├─ PATCH negócio (etapa + amount)
                                  ├─ substitui itens de linha
                                  ├─ cria orçamento nativo (quote) publicado
                                  └─ devolve nº, total, link do HubSpot
                                          │
                                          ▼
                        DOCUMENTO imprimível (PDF) + link + compartilhar
```

---

## 2. BACKEND — `api/` (9 arquivos)

Todas as rotas respondem JSON `{ ok: true|false, ... }` e usam a sessão por cookie
(`zln_sessao`, HMAC-SHA256 com `SESSAO_SECRET`, `HttpOnly; Secure; SameSite=None`,
validade `SESSAO_HORAS` — padrão 12h). `SameSite=None` permite rodar dentro de
iframe do HubSpot (cartão de CRM).

### 2.1 `_lib.js` — biblioteca central (sem rota)

| Função | O que faz |
|---|---|
| `CFG` | Config por env: `token`, `pipeline` (799744057), `etapaOrcamento` (1173938947), `propCpf` (`cpf_`), `sessaoSecret`, `sessaoHoras`, `modeloOrcamentoId` (565494573213) |
| `hs(caminho, opts)` | Chamada autenticada à API do HubSpot (`api.hubapi.com`), lança erro com `status` |
| `sessaoDoRequest / setCookieSessao / limparCookieSessao` | Sessão assinada; o payload guarda `{papel, negocioId, contatoId, nome}` — **a sessão fica presa ao negócio do link** |
| `json(res, status, corpo)` | Resposta padrão |
| `lerBody(req)` | Parse do corpo JSON |
| `propsProduto()` | **Detecção automática** (cache 30 min) das propriedades de produto: Status (escolhe a candidata que tem opção "Ativo/Active" — bilíngue), Grupo de Liberação, Categoria (+ mapa valor→rótulo das opções). Overrides: `PROP_STATUS_PRODUTO`, `VALOR_STATUS_ATIVO`, `PROP_GRUPO_LIBERACAO`, `PROP_CATEGORIA_PRODUTO` |
| `catalogoProdutos()` | Catálogo completo paginado (cache 10 min). Por produto: `id, nome, preco, sku, descricao, foto (hs_images), ativo, grupo, categoria` (do grupo: FLOR/EXTRATO/OLEO), `dominancia` (\_CBD/\_THC), `gramas` (regex `(\d+)g` no nome, default 5), `categoriaLoja` (rótulo da propriedade Categoria), `statusBruto` |
| `produtosVendaveis(produtos)` | **Regra do vendável** = `ativo` **e** nome contém o filtro (`FILTRO_NOME_PRODUTO`, default `anova`; valor `todos` desliga) |
| `casarReceita(itensReceita, produtos)` | **Regra fixa de liberação** (sem IA): normaliza categoria (flor/inflorescência/bud · extrato/resin/rosin/hash · óleo · comestível) e dominância (CBD/THC/BAL/null). Produto libera se algum item da receita tem a **mesma categoria** e dominância **compatível** (ausente de um lado = libera; contradição explícita = bloqueia; produto sem grupo = bloqueia). Gera `grupos` de limite (`chave = categoria-dominância`, `gramas`, `período`; itens repetidos → vale o maior; sem quantidade → sem limite) e `liberados` (`grupo`, `gramasPorUnidade`) |
| `propriedadesDeAnexo()` | Descobre (cache 30 min) as propriedades de contato/negócio com "anexo" no rótulo/nome; cada uma vira um grupo de documentos com o título limpo ("Anexo da Receita" → "Receita") |

### 2.2 `abrir.js` — `GET /api/abrir?negocio=ID&chave=CHAVE` (maxDuration 30s)

Porta de entrada sem login:
1. `chave` deve bater com `PAINEL_CHAVE` (senão 401)
2. Carrega o negócio (com as propriedades de anexo) e valida: pipeline correto **e** etapa dentro de `ETAPAS_LISTA` (padrão: 6 etapas pré-pagamento — 1173938946/45/47, 1289128497, 1362211507, 1173938948); fora disso → "não está numa etapa de orçamento"
3. Contato associado obrigatório → carrega `nome, email, telefone, cpf_, zip`
4. Nome do vendedor = dono do negócio (`/crm/v3/owners/{id}`)
5. **Documentos por tipo** (cada etapa blindada — uma falha não derruba as outras):
   - Grupos oficiais: valores das propriedades de anexo (ids de arquivo separados por `;`/`,`)
   - Anexos soltos das notas do contato e do negócio (`associations/notes` + `notes/batch/read` → `hs_attachment_ids`, cap 30 notas)
   - Detalhes via `/files/v3/files/{id}` (cap 20, paralelo)
   - Soltos classificados pelo **nome do arquivo**: `Receita` · `Identidade (RG/CNH)` · `Comprovante de endereço` · `Outros anexos` (sempre por último)
6. **Orçamentos anteriores**: quotes associados ao negócio (`hs_title, hs_createdate, hs_quote_link, hs_quote_amount`), ordenados do mais novo
7. Abre a sessão presa ao negócio e devolve `{negocio, cliente, vendedor, documentos, orcamentosAnteriores}`

### 2.3 `produtos.js` — `GET /api/produtos`

Sessão obrigatória. Devolve `produtosVendaveis` mapeados
(`id, nome, preco, sku, descricao, foto, categoria` — rótulo da Categoria, vazio → "Outros").
**Válvula de segurança:** se o filtro zerar um catálogo que existe, devolve todos
com `filtroAtivoFalhou: true` (operação nunca para por configuração errada).

### 2.4 `receita.js` — `GET /api/receita?contato=ID[&negocio=ID][&forcar=1]` (maxDuration 60s)

1. Chama o webhook do n8n (`N8N_RECEITA_URL`) que devolve a **extração pura** da receita
2. Se `status:'ok'` com `itensReceita`: roda `casarReceita` contra os **vendáveis**
   (mesma válvula) e devolve `{...extração, liberados, grupos}`
3. Resposta fora do formato → erro mostrando os 200 primeiros caracteres do corpo bruto
   (diagnóstico); o front trata como falha técnica (fail-open com aviso)

### 2.5 `orcamento.js` — `POST /api/orcamento`

Corpo: `{negocioId, contatoId, itens:[{produtoId, nome, preco, quantidade, desconto?{tipo,valor,origem}}], frete, freteNome}`.
Cadeia de validações **no servidor** (independente da tela):
1. Sessão + **trava de sessão**: `negocioId` do corpo deve ser o do link (403 se diferente)
2. **Trava da receita** (dupla checagem): lê `receita_liberada` do contato; se `status:'ok'`:
   receita vencida → 400; recomputa `casarReceita` com o catálogo; produto fora dos
   liberados → 400 nominal; soma de gramas por grupo acima do limite → 400 com o teto
3. **Trava de desconto**: soma dos descontos ≤ `LIMITE_DESCONTO_PCT`% (default 20) do subtotal
4. `PATCH` no negócio: `dealstage = etapaOrcamento` + `amount = total`
5. **Substitui** os itens de linha: apaga os existentes (associação 20) e cria os novos em batch —
   `hs_discount_percentage` (%) ou `discount` (R$) + `origem_do_desconto`
   ("Desconto Pessoal"/"Desconto Zeleno"); frete entra como item
   ("Frete - Modalidade", inclusive a R$ 0 quando Exclusivo foi escolhido)
6. Cria **quote nativo** publicado: título "Orçamento — {cliente} — {data}", validade 30 dias,
   modelo `MODELO_ORCAMENTO_ID`, associações quote→negócio (64), →contato (69),
   →template (286), itens→quote (68); falha aqui **não** derruba a resposta —
   volta `avisoOrcamento`
7. Resposta: `{ok, numero, total, linkHubspot?, avisoOrcamento?}`

### 2.6 `arquivo.js` — `GET /api/arquivo?arquivo=ID`

Sessão obrigatória → `/files/v3/files/{id}/signed-url` → **302 redirect** para o link
temporário. Nenhuma URL permanente do HubSpot é exposta ao navegador.

### 2.7 `diagnostico.js` — `GET /api/diagnostico`

Painel de saúde (sem sessão): estado das variáveis, conexão HubSpot, pipeline/etapa
resolvidas, **documentos** (propriedades de anexo descobertas), **catalogo**
(propriedade Status detectada + candidatas com opções, valor considerado Ativo,
contagem por valor, `mostradosNoPainel`, `ativosSemGrupo`, `categoriasEncontradas`),
origem do desconto (opções reais), modelos de orçamento e o modelo em uso.

### 2.8 `cartao.js` — `GET /api/cartao?chave=...&associatedObjectId=ID`

Endpoint de **cartão de CRM** (formato clássico): valida a chave e devolve o card
com `primaryAction` do tipo `IFRAME` (1280×860) apontando o painel para aquele
negócio. *Status: pronto no backend; a criação de cartões clássicos foi
descontinuada pelo HubSpot — caminho atual é o link; extensão de interface (CLI)
fica como projeto futuro.*

### 2.9 `oauth.js` — `GET /api/oauth?code=...`

Conclui instalação OAuth de app público (troca o `code` usando `HS_CLIENT_ID`/`HS_CLIENT_SECRET`;
não guarda tokens). *Mesmo status do cartão: mantido para o futuro.*

### `vercel.json`

`maxDuration`: `receita.js` 60s, `abrir.js` 30s ·
Header global `Content-Security-Policy: frame-ancestors 'self' https://*.hubspot.com`
(só o HubSpot pode embutir o painel).

---

## 3. FRONTEND — `index.html` (arquivo único, ~128 KB)

Sem framework. Design system próprio (CSS custom properties): Bricolage Grotesque
(display) + Inter (texto), paleta verde-mata/papel, logo oficial embutida em base64
(3 usos + favicon), marca d'água da folha em SVG data-URI, impressão com
`print-color-adjust` garantido.

### 3.1 Estado global

```js
estado = {
  vendedor, contatoSel, negocioSel,        // vindos do /api/abrir
  produtos: [],                            // catálogo vendável
  carrinho: Map(produtoId → qtd),
  descontos: Map(produtoId → {tipo:'%'|'R$', valor, origem:'pessoal'|'zeleno'}),
  receita: null | {status, liberados:Set, motivos, info{id→{grupo,gPorUn}},
                   grupos{chave→{gramas,descricao,periodo}}, resumo, validaAte,
                   receitaVencida, observacoes} | {status:'sem'|'erro'},
  passo: 2|3, paginaProdutos, categoriaSel,
}
jaTemOrcamentos  // contador p/ confirmação de substituição
```

### 3.2 Boot (entrada pelo link)

`?negocio=ID&chave=...` → `GET /api/abrir` → `iniciarApp(d)`:
preenche ficha e cabeçalho, `desenharDocumentos`, `prepararEntrega` (CEP já consulta),
`carregarProdutos`, `carregarReceita(false)`, `irParaPasso(2)`.
Sem parâmetros ou erro → tela de aviso com **Tentar de novo** (`location.reload`).
Resposta não-JSON do servidor → erro com o HTTP (nunca tela muda).
401 em qualquer rota → aviso de sessão expirada com retry.

### 3.3 Cabeçalho do cliente

- Avatar com inicial (gradiente mata) + nome + linha `CPF · telefone · CEP · negócio`
- **editar**: abre a ficha (nome, CPF, e-mail, telefone, CEP) — em telas ≤640px vira
  **gaveta de baixo** (bottom sheet com alça e botão "Concluir edição"); cabeçalho
  atualiza a cada tecla; o CEP editado repropaga frete
- **Documentos (N)**: botão sóbrio (ícones SVG, zero emoji) que expande painel em
  cartões por grupo (Receita / Identidade / Comprovantes / Outros), cada arquivo
  com ícone por extensão, nome elipsado e "Abrir" → `/api/arquivo` em nova aba

### 3.4 Tela 1 — Produtos (montagem completa do pedido)

- **Banner da receita** (executivo, filete verde): `Receita conferida` + **chips com
  saldo em tempo real** por grupo (`Extratos THC · restam 30g/mês`, vermelho ao
  zerar) + `válida até` + `detalhes` (resumo/observações da IA) + `reler receita`
  (força ignorar o cache). Estados: `lendo` / `ok` / `vencida` / `sem receita` /
  `erro` (fail-open: libera com aviso âmbar — conferência manual)
- **Busca** global (ignora categoria; volta pra pág. 1)
- **Vitrine de categorias**: lista vertical em largura total — ícone por categoria
  (flor/óleo/extrato/comestível em SVG de traço), nome + contagem, seta; clique
  filtra; `‹ Categorias` volta
- **Linha do produto**: foto 62px · nome · **coluna do limite** (`Receita: até 8 un
  (40g) · restam 6`, soma o grupo inteiro, vermelha no teto; em telas estreitas
  desce pra linha própria) · **preço em coluna à direita** · **stepper − 0 +**
  sempre visível (no zero: − desabilitado, + verde preenchido; no limite: +
  desabilitado)
- **Sub-linha de desconto** (aparece com item no carrinho): `% | R$` + valor +
  origem `Pessoal|Zeleno` + total do item ao vivo; digitação preservada
  (só o total re-renderiza)
- **Card Entrega**: topo com CEP + cidade (ViaCEP; fallback por faixa de CEP);
  opções empilhadas com rádio customizado — Entrega SP capital R$ 40 · Sedex
  R$ 60 · Exclusivo R$ 0 (constante `FRETES`, ⚠️ valor a definir); marcação
  automática pelo CEP (capital vs. Sedex); valor editável com prefixo R$
- **Paginação** 10/pág (`PRODUTOS_POR_PAGINA`), rolagem suave à busca; mexer no
  carrinho **não** redesenha a lista (delegação de eventos + atualização por linha)
- **Cupom fixo** (recibo com picote): `N itens · desc. − X · frete Y` + **total
  final**; trava dos 20% desliga o botão ali mesmo com o máximo em R$; recolhe ao
  rolar pra baixo e volta ao subir
- **Toast** ao adicionar/remover; **skeleton** no carregamento; erro com
  "Tentar de novo"

### 3.5 Tela 2 — Revisão (resumo puro)

Itens em leitura (qtd × preço, etiqueta verde do desconto com origem, valor final),
caixa de totais (gradiente mata) com a trava dos 20% reforçada, `Voltar aos
produtos`, **Gerar orçamento**.

### 3.6 Gerar → Documento

1. Se `jaTemOrcamentos > 0` → `confirm()` de substituição
2. Botão narra o progresso ("Lançando itens…", "Criando o orçamento…")
3. Sucesso → **overlay com check animado** (nº do orçamento) → documento
4. **Documento**: folha imprimível com identidade Zeleno (logo, cabeçalho gradiente,
   marca d'água, tabela zebrada, bloco do cliente, totais com desconto/frete,
   rodapé de recibo) — barra fixa: `Imprimir / Salvar PDF` (via `@media print`
   só a folha sai), `Abrir link do orçamento` (quote do HubSpot),
   `Compartilhar` (Web Share API, some sem suporte), `Novo orçamento`
   (limpa carrinho/descontos/frete e volta aos produtos do mesmo negócio)
5. `beforeunload` avisa se fechar com carrinho não gerado

### 3.7 Guardas de qualidade embutidas no processo de entrega

Toda modificação passa por: sintaxe JS (vm), **pareamento de chaves do CSS**,
pareamento de `<div>`, unicidade de ids críticos, **caça-fantasmas** (toda função
chamada precisa estar definida — pega qualquer capitalização) e ausência de
duplicação de funções.

---

## 4. FLUXOS n8n

### 4.1 "Zeleno - Leitura de Receita" (webhook `POST /webhook/zeleno-receita`)

`Webhook → Preparar receita → Já resolvido? → (Usar resultado pronto | IA lê a receita → Concluir e gravar) → Responder`

- **Preparar** (Code): busca anexos de receita do contato **e** do negócio
  (`anexo_da_receita`), calcula `hashAnexos`; **cache** na propriedade de contato
  `receita_liberada` (versão 2) — mesmo hash e sem `forcar` → responde na hora;
  senão baixa até 3 arquivos (signed-url), monta o corpo pro OpenAI
- **IA** (HTTP → `/v1/responses`, `gpt-4.1-mini`, credencial "OpenAi Black Yellow"):
  **só extrai** — itens `{descricao, categoria, dominancia, gramas, periodo}` +
  validade (regra: expressa → calcula; ausente → 6 meses da emissão) + vencida +
  resumo + observações. **Quem decide liberação é o servidor** (aceite LOJ-011)
- **Concluir** (Code): parseia, normaliza, grava `receita_liberada` no contato
  (JSON com `versao: 2`, `hashAnexos`, `lidoEm`); tolerante a nós renomeados com
  sufixo "1"; sem a propriedade → devolve com `aviso`

### 4.2 "Zeleno - Link do Orçamento nos Negócios" (agendado, 2 min)

Busca negócios da pipeline `799744057` **em qualquer etapa** com `link_orcamento`
vazio (até 500/rodada) e preenche
`https://interface-or-amentos.vercel.app/?chave=...&negocio={id}`.
Só escreve o link; não toca em etapa/valor/dono. Link em negócio pós-pagamento
existe mas o `abrir` recusa (etapa fora da lista).

---

## 5. HubSpot — propriedades e IDs em uso

| Item | Valor |
|---|---|
| Portal | 49299170 |
| Pipeline | `799744057` (Pipeline de vendas e recompra) |
| Etapa pós-gerar | `1173938947` (Em Tratativa - Orçamento enviado) |
| Etapas que abrem o painel | 1173938946 · 1173938945 · 1173938947 · 1289128497 · 1362211507 · 1173938948 |
| Modelo de quote | `565494573213` (Orçamento Zeleno Foto) |
| Contato | `cpf_`, `zip`, `anexo_da_receita`, `receita_liberada` (cache da leitura) |
| Negócio | `link_orcamento`, `anexo_da_receita`, `amount`, `dealstage` |
| Produto | `hs_status` (`active`/`inactive`), `grupo_de_liberacao` (`FORNECEDOR_CATEGORIA[_DOMINÂNCIA]`), Categoria (rótulos Flor/Extrato/Óleo), `price`, `hs_images`, `hs_sku` |
| Item de linha | `hs_discount_percentage` · `discount` · `origem_do_desconto` |
| Associações (typeId) | negócio→contato 3 · item→negócio 20 · quote→negócio 64 · item→quote 68 · quote→contato 69 · quote→template 286 |

---

## 6. Variáveis de ambiente (Vercel)

**Obrigatórias:** `HUBSPOT_TOKEN` · `SESSAO_SECRET` · `PAINEL_CHAVE` · `N8N_RECEITA_URL` · `MODELO_ORCAMENTO_ID`
**Opcionais (com default):** `PIPELINE_ID` · `ETAPA_ORCAMENTO` · `ETAPAS_LISTA` · `HUBSPOT_PROP_CPF` · `SESSAO_HORAS` · `LIMITE_DESCONTO_PCT` (20) · `FILTRO_NOME_PRODUTO` (anova / `todos` desliga) · `PROP_STATUS_PRODUTO` · `VALOR_STATUS_ATIVO` · `PROP_GRUPO_LIBERACAO` · `PROP_CATEGORIA_PRODUTO` · `HS_CLIENT_ID`/`HS_CLIENT_SECRET` (só p/ oauth)

---

## 7. Segurança

- Sem login: acesso só pelo link com `PAINEL_CHAVE`; sessão HMAC presa ao negócio
  do link (gerar para outro negócio → 403)
- Cookie `HttpOnly; Secure; SameSite=None` (iframe HubSpot) · CSP `frame-ancestors`
  restrito ao HubSpot · anexos via redirect com signed-url (sessão obrigatória)
- Todas as travas (receita, gramas, 20%) revalidadas no servidor
- ⚠️ Pendência: rotacionar `HUBSPOT_TOKEN` (exposto em conversa/prints)

## 8. Encaixes futuros (LOJ-011)

- **AUT-005** (validação de documentação): plugar no `abrir.js` (bloqueio na
  entrada) + reconferência no `orcamento.js`
- **REC-006** (banco de saldo de receita): substituir o `casarReceita` local por
  consulta ao banco — pontos únicos de troca: `receita.js` e a trava do
  `orcamento.js`
- Decisões pendentes: comportamento em falha técnica (hoje fail-open com aviso),
  exceções às travas (Laysla), data de corte do caminho antigo, valor real do
  frete Exclusivo, interpretação "15g cada = mês ou pedido"
