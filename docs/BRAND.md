# SubManager · Manual de marca

## Essência

SubManager é o painel onde a clínica de cirurgia bucomaxilofacial conduz cada paciente pela sua jornada: cadastro, escolha do fluxo, avanço etapa por etapa, documentos enviados no momento certo e nenhum prazo esquecido.

**Assinatura:** Da entrada do paciente ao acompanhamento, etapa por etapa.

**Promessa:** a equipe sempre sabe onde cada paciente está e o que vem a seguir.

**Para quem falamos:** cirurgiões, secretárias e coordenadoras de clínica. Gente ocupada, que trabalha entre consultório, telefone e WhatsApp. Lê a tela de relance.

### Personalidade

| Somos | Não somos |
| --- | --- |
| Precisos: cada etapa tem nome, prazo e dono | Burocráticos ou cheios de jargão técnico |
| Serenos: a tela acalma, não alarma | Frios ou hospitalares |
| Clínicos: sério com dado de paciente | Divertidos às custas da confiança |
| Diretos: o verbo primeiro | Vendedores: nada de "revolucionar" ou "potencializar" |

## Logo

### O símbolo: Trilha em S

O símbolo é um "S" desenhado como um percurso com três nós, lido de cima para baixo:

- **Nó vazado (topo):** a entrada do paciente.
- **Nó cheio (centro):** a etapa concluída.
- **Nó azul céu (base):** a etapa atual, o único ponto de cor.

O bloco `primary` com cantos `radius-lg` (12px a 48px) já existia no menu lateral do produto; o símbolo ocupa esse mesmo lugar.

### Versões

| Arquivo | Quando usar |
| --- | --- |
| `public/brand/submanager-horizontal.svg` | Padrão. Cabeçalhos, login, e-mails, documentos, propostas. |
| `public/brand/submanager-horizontal-escuro.svg` | Sobre `background` escuro (#0c141b) ou fotos escuras. |
| `public/brand/submanager-vertical.svg` | Espaços quadrados: capa de apresentação, tela de carregamento, crachá. |
| `public/brand/submanager-simbolo.svg` | Menu lateral recolhido, avatar do WhatsApp, redes, favicon acima de 32px. |
| `public/brand/submanager-simbolo-escuro.svg` | Menu lateral no tema escuro (bloco `sidebar-primary`, traço `sky`). |
| `public/brand/submanager-app-icon.svg` | Ícone de app, PWA e favicon (o bloco preenche o canvas). |
| `public/brand/submanager-monocromatico.svg` | Uma cor só: impressão P&B, carimbo, gravação, fax. Sem bloco. |

### Área de proteção e tamanho mínimo

- Deixe livre em volta do logo uma margem igual à metade da altura do símbolo (24px quando o símbolo tem 48px). Nada de texto, borda ou imagem nessa área.
- Símbolo: mínimo 16px na tela, 6mm impresso. Abaixo de 24px o nó vazado vira ponto; está previsto.
- Logo horizontal: mínimo 120px de largura na tela, 30mm impresso.

### Não faça

- Não recolora o símbolo fora das duas combinações oficiais (tinta + pedra + céu; `sidebar-primary` + céu + pedra).
- Não use `sky` no traço inteiro: o azul céu marca só a etapa atual.
- Não gire, espelhe, distorça, contorne ou aplique sombra no logo.
- Não reescreva o nome em outra fonte, nem separe "Sub" e "Manager" com espaço, hífen ou cores diferentes.
- Não coloque o logo horizontal claro sobre fundo escuro: use a versão escura.

## Cor

A paleta é "pedra fria, tinta petróleo e azul céu só para marcar". Ela é neutra quase o tempo todo; a cor aparece onde há informação.

### Proporção

Em qualquer tela ou peça, mire em: **70% pedra** (`background`, `card`, `surface`), **20% tinta** (`foreground`, `primary`), **8% petróleo** (`brand`, `accent`, `info`), **2% céu** (`sky`).

### Cores da marca

| Token | Claro | Escuro | Papel |
| --- | --- | --- | --- |
| `background` | #eef1f3 | #0c141b | Pedra fria. O chão de tudo. |
| `foreground` / `primary` | #0e1d29 | #edf3f6 / #7cc0de | Tinta petróleo. Texto e ação principal. |
| `brand` | #2b7a9e | #5aa9cc | Petróleo médio. Links e realces. |
| `accent-foreground` / `info` | #1d5878 | #7cc0de | Petróleo profundo. Seleção, foco, informação. |
| `sky` | #8ec3db | #8ec3db | Azul céu. A etapa atual. Raro de propósito. |

### Regras

- Texto corrido sempre em `foreground` sobre `background`, `card` ou `surface`. Texto de apoio em `muted-foreground`.
- Use `brand` como texto só sobre `card`; sobre `background` ele fica em 4.2:1 e só serve para 19px bold ou maior.
- Use `sky` apenas sobre a tinta (`foreground`, `primary`, `sidebar-primary`). Nunca como texto em fundo claro.
- Status sempre em par sólido + suave: `success` sobre `success-soft`, `warning` sobre `warning-soft`, `destructive` sobre `destructive-soft`. E sempre com palavra ou ícone junto ("Em dia", "Atenção", "Crítico"): nunca só a cor.
- `whatsapp` é exclusivo do canal WhatsApp. Não use como verde de sucesso.
- `destructive` nunca é cor de marca, de destaque ou de gráfico decorativo.
- Sem gradientes, sem brilho, sem roxo. Sombras são tingidas da tinta (`shadow-s1` a `shadow-s3`), nunca preto puro.

## Tipografia

- **Outfit** é a voz da marca e da interface (Google Fonts, pesos 400, 500, 600, 700 e 800). Carregue com `next/font`, variável `--font-outfit`.
- **Geist Mono** só para dados: prazos de SLA, códigos, IDs, horários em tabela.

### Hierarquia

- Título de página em `h1` (24px, 700). Título de card e modal em `h2` (18px, 600). Ambos com `letter-spacing: -0.025em`.
- Texto da interface em `body` (14px). Rótulos e nomes em listas em `body-strong` (14px, 500).
- Metadados e ajuda de campo em `caption` (12px) com `muted-foreground`. Nada de texto corrido abaixo de 12px.
- `overline` (11px, caixa alta) só nos rótulos de grupo do menu lateral.
- `display` (48px, 800) só em capas, apresentações e páginas públicas, com no máximo duas linhas.
- Dê peso com 500 e 600. Use 700 em títulos e 800 só no nome da marca e em `display`.

## Voz e tom

Falamos como uma coordenadora experiente explicando o próximo passo para a equipe: clara, calma e sem rodeio.

### Princípios

- **Trate por "você".** "Use o email e a senha do seu espaço de trabalho."
- **Verbo primeiro, frase curta.** "Mova este paciente para outra etapa da mesma jornada publicada."
- **Diga o que acontece depois.** "O paciente será retirado do quadro ativo. O histórico de etapas e documentos é mantido e uma nova jornada poderá ser iniciada depois."
- **Confirmações em duas ou três palavras.** "Etapa atualizada." "Tratamento concluído."
- **Estados vazios explicam o vazio.** "Nenhum paciente nesta etapa."
- **Caixa de frase** em títulos, botões e menus ("Novo paciente", não "Novo Paciente").
- **Sem emoji** na interface. Sem travessão longo: use ponto, vírgula ou dois-pontos.
- **Erros dizem como resolver**, sem culpar: "Não foi possível enviar os documentos. Confira o número de WhatsApp do paciente e tente de novo."

### Com o paciente (WhatsApp e portal)

O tom fica mais acolhedor e explica o porquê. Exemplo do produto: "Você foi movido para a etapa 2. O assistente vai te enviar todos os documentos e orientações dessa fase."

### Glossário

| Use | Evite | Por quê |
| --- | --- | --- |
| paciente | cliente, lead | É como a clínica chama. "Contato" só para quem ainda não é paciente. |
| jornada | pipeline, funil | A jornada é do paciente, não de vendas. |
| etapa | stage, fase | Unidade da jornada; "fase" fica para fases do produto. |
| fluxo | workflow | O modelo de jornada que a clínica desenha. |
| clínica | tenant, empresa | "Tenant" é termo técnico; na tela, diga "clínica". |
| equipe | usuários | Pessoas da clínica que usam o painel. |

## Forma, espaço e movimento

- **Cantos:** um sistema só, derivado de `--radius` (0.75rem). `radius-sm` em badges, `radius-md` em campos e botões, `radius-lg` em cards, `radius-xl` em modais. Avatares e nós em `radius-full`.
- **Espaço:** base de 4px. Padding de card `space-6`, gap entre campos `space-4`, margem de página `space-8`.
- **Elevação:** cards em repouso com `shadow-s1` e borda `border`; popovers com `shadow-s2`; drawers com `shadow-s3`. Prefira borda e espaço a sombra.
- **Movimento:** curva `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-kit`), 150 a 250ms. Anime só `transform` e `opacity`, e só para mostrar mudança de estado (paciente mudou de etapa, mensagem chegou). Com `prefers-reduced-motion`, sem animação.

## Iconografia

- O produto usa **Lucide** (`lucide-react`). Mantenha a família, traço 2, tamanhos 16px no texto e 18px no menu.
- Ícone sozinho precisa de `aria-label` ou tooltip.
- No código, o símbolo é o componente `BrandMark` (`src/shared/components/brand/brand-mark.tsx`). Ele lê `--mark-tile`, `--mark-line` e `--mark-now` de `globals.css` e troca de cor com o tema; use `tone="dark"` em superfícies sempre escuras.
- Sem emoji como ícone, nem em mensagens da interface.

## Acessibilidade

- Contraste medido nos dois temas: `foreground` 15:1 (claro) e 16.6:1 (escuro); `muted-foreground` acima de 5.3:1; todos os pares de status acima de 4.7:1.
- Foco visível em todo elemento interativo: anel sólido de 2px em `ring` (6.8:1 no claro, 8:1 no escuro).
- O contorno `input` fica abaixo de 3:1 nos dois temas. Todo campo leva rótulo visível acima e o foco em `ring` compensa; ao revisar o tema, vale escurecer `input` (ex.: #8a99a4 no claro).
- Alvos de toque com no mínimo 44 × 44px no portal do paciente.

## Aplicações

- **Favicon e PWA:** `src/app/icon.svg`, `src/app/apple-icon.png` (180px) e `src/app/favicon.ico` (16, 32 e 48px), gerados a partir de `public/brand/`.
- **Avatar do WhatsApp da clínica:** use o símbolo apenas se a conta for da plataforma. Conta da clínica usa o logo da clínica.
- **E-mails transacionais:** cabeçalho com `submanager-horizontal-escuro.svg` sobre #0c141b (o template escuro que já existe), corpo em `card`.
- **Apresentações e propostas:** capa em `background` claro, logo vertical, título em `display`; um único bloco de `primary` por slide, no máximo.
- **Documentos da clínica (PDF):** o logo da clínica manda; o SubManager aparece só no rodapé, em monocromático, com "Enviado por SubManager".
