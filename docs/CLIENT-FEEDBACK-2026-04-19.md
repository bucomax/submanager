# Feedback do Cliente — 19/04/2026

Análise do feedback recebido, organizado por nível de entendimento e viabilidade técnica.

---

## A — Visual (UX/UI)

Todos os itens foram entendidos. São ajustes de layout e componentes existentes, sem mudança de backend.

### A.1 — Blocos visuais mais separados

**Entendimento:** Cards com bordas e espaçamento bem definidos. Hoje as informações estão grudadas, sem separação clara entre blocos.

**O que fazer:** Revisar os componentes de detalhe do paciente (`client-detail-*`). Aumentar `gap` entre cards, usar padding maior (`p-6`), separar seções com títulos ou divisores.

---

### A.2 — Seções claras: identificação, status, ações, documentos, histórico

**Entendimento:** A ficha do paciente mistura tudo num scroll longo sem agrupamento claro.

**O que fazer:** Reorganizar a ficha do paciente em abas ou seções colapsáveis — **Identificação**, **Jornada/Status**, **Documentos**, **Histórico de transições**.

---

### A.3 — Destacar etapa atual, status e próxima ação

**Entendimento:** A etapa atual tem o mesmo peso visual que informações secundárias. O usuário precisa procurar o que é mais importante.

**O que fazer:** Criar um "hero card" no topo da ficha com: etapa atual (badge grande colorido), SLA restante (barra de progresso ou countdown), botão principal da próxima ação.

---

### A.4 — Colapsar/expandir para reduzir informação visível

**Entendimento:** Tudo fica aberto sempre, sobrecarregando a tela.

**O que fazer:** Implementar seções com `Collapsible` (shadcn) — ex.: checklist, histórico de transições, documentos. Estado persistido em `localStorage` via Zustand.

---

### A.5 — Melhorar espaçamento entre elementos

**Entendimento:** Elementos grudados, sem "respiro" visual.

**O que fazer:** Audit de padding/gap nos componentes de detalhe: mínimo `gap-6` entre cards, `p-6` nos cards, `space-y-4` interno.

---

### A.6 — Um botão de destaque por tela

**Entendimento:** Múltiplos botões com mesmo peso visual confundem o usuário. Não fica claro qual é a ação principal.

**O que fazer:** Definir hierarquia: 1 botão `default` (primário) por seção, demais como `outline` ou `ghost`. Ex.: na jornada, o destaque é "Avançar etapa".

---

### A.7 — Agrupar checklist + mudança de etapa

**Entendimento:** Hoje checklist e transição estão separados visualmente, mas são uma ação conjunta.

**O que fazer:** Unificar num único card "Transição de etapa" que mostra checklist + botão de avançar. Checklist incompleto desabilita o botão (com tooltip explicativo).

---

### A.8 — Resumo do paciente no topo com status geral

**Entendimento:** Não existe um "header de contexto" rápido com as informações essenciais do paciente.

**O que fazer:** Criar componente `PatientSummaryHeader`: nome, telefone, pathway ativo, etapa atual, SLA, badge de risco (verde/amarelo/vermelho). Fixo no topo da ficha.

---

### A.9 — Melhorar hierarquia visual (títulos, tamanhos, contraste)

**Entendimento:** Títulos e labels têm tamanho/peso muito similar. Tudo parece ter a mesma importância.

**O que fazer:** Definir escala tipográfica consistente: `text-xl font-semibold` para títulos de seção, `text-sm font-medium` para labels, `text-xs text-muted-foreground` para metadata.

---

### A.10 — Prioridade visual clara

**Entendimento:** Tudo tem o mesmo nível de destaque. O olho do usuário não sabe para onde ir primeiro.

**O que fazer:** Combinação dos itens A.3, A.6 e A.9. Aplicar cor, tamanho e posição para criar hierarquia no padrão F-pattern (leitura natural).

---

## B — Operacional (Inteligência e Automação)

### O que entendemos

---

### B.3 — WhatsApp: envio automático por etapa, lembretes e follow-ups

**Entendimento:** Já temos envio na transição de etapa. Falta: lembretes automáticos (cron) e follow-up se o paciente não respondeu.

**O que fazer:** Criar job BullMQ de lembretes agendados por etapa (ex.: "lembrete pré-cirúrgico 48h antes"). Adicionar campo `reminderOffsetHours` no `PathwayStage`. Job consulta pacientes na etapa e dispara WhatsApp. Follow-up: reenvio se não houve interação em X horas.

---

### B.6 — Transição de etapas com botão contextual e validação automática

**Entendimento:** Já temos checklist obrigatório + bloqueio. Falta: botão contextual ("Avançar para Exames" em vez de genérico "Avançar"), e validação automática (ex.: se todos os exames foram enviados, libera o botão).

**O que fazer:** Renomear botão de transição com o nome da próxima etapa. Adicionar `autoValidationRules` no `PathwayStage` (JSON) para validações automáticas (documentos enviados, checklist completo, tempo mínimo).

---

### B.7 — Dashboard com métricas de gestão

**Entendimento:** Temos dashboard básico. Falta: tempo médio por etapa, identificação de gargalos (etapas onde pacientes ficam parados), taxa de conversão (cadastro → cirurgia).

**O que fazer:** Criar queries agregadas em `StageTransition`: tempo médio entre transições por etapa, pacientes parados > SLA, funil de conversão por pathway. Novos cards no dashboard com gráficos (recharts).

---

### B.8 — Explicação em cada etapa

**Entendimento:** Cada etapa deveria ter uma descrição do que fazer, por que fazer e impacto do atraso. Hoje a etapa é só um nome.

**O que fazer:** Adicionar campos `instructions` (o que fazer), `rationale` (por que) e `delayImpact` (impacto do atraso) no `PathwayStage`. Exibir num card informativo na ficha do paciente quando estiver naquela etapa.

---

### B.10 — Alertas inteligentes (atraso, inatividade, risco)

**Entendimento:** Já temos alertas SLA (`sla_warning`, `sla_critical`). Falta: alerta por inatividade (paciente sem interação há X dias) e risco clínico (baseado em dados do paciente).

**O que fazer:** Criar job de inatividade: consulta pacientes sem transição/interação há N dias, gera notificação. Risco clínico depende do módulo de prontuário (item C).

---

### B.11 — Integrar módulos entre si

**Entendimento:** Paciente, documentos, jornada, alertas e comunicação hoje são parcialmente integrados.

**O que fazer:** Já existe integração parcial (transição → documentos → WhatsApp). Próximo passo: documentos uploadados atualizarem checklist automaticamente; alertas linkarem diretamente à ficha do paciente.

---

### O que não entendemos — Perguntas para o cliente

---

### B.1 — "Próxima ação recomendada" baseada na etapa e contexto

**Pergunta:** O que seria "contexto" além da etapa atual? O sistema deveria considerar dados clínicos do paciente (tipo de cirurgia, complexidade), tempo na etapa, documentos pendentes? Pode dar 2-3 exemplos concretos de "próxima ação recomendada" que vocês gostariam de ver na tela?

---

### B.2 — Motor de regras (se… então…) para automatizar decisões

**Perguntas:**
- Que tipo de decisões e ações vocês querem automatizar? Exemplos que imaginamos: "se checklist completo → avançar etapa automaticamente", "se SLA vencido → notificar gestor". Estão corretos?
- Vocês querem criar essas regras pela interface (tipo arrastar blocos) ou seriam regras fixas que nós configuramos?
- As regras envolvem só dados do sistema ou dados externos (ex.: resultado de exame, resposta do paciente)?
- Pode dar 3-5 exemplos de regras reais que usariam no dia a dia?

---

### B.4 — Responsáveis por etapa obrigatório, fallback e fila de responsabilidade

**Perguntas:**
- O responsável é sempre o médico titular ou pode ser outro profissional (enfermeiro, secretária)?
- O que é "fallback automático" — se o responsável não agir em X horas, passa para quem? Para um backup específico ou para qualquer um disponível?
- "Fila de responsabilidade" significa uma ordem de prioridade? Ex.: 1º Dr. João → 2º Dra. Maria → 3º Coordenação?
- A responsabilidade muda por etapa? Ex.: pré-op é da secretária, cirurgia é do médico, pós-op é do enfermeiro?

---

### B.5 — Documentos por etapa com templates, geração automática e controle de versão

**Perguntas:**
- Que tipos de documentos gostariam de gerar automaticamente? Ex.: termo de consentimento, pedido de exames, relatório cirúrgico, atestado?
- Os templates teriam variáveis preenchidas com dados do paciente (nome, CPF, procedimento, data)?
- "Controle de versão" significa manter histórico de alterações no mesmo documento ou versões diferentes de um template?
- "Envio ao paciente" seria por WhatsApp, e-mail, ou portal do paciente?

---

### B.9 — Bloco de "próximas ações" para guiar o usuário

**Pergunta:** É diferente do item B.1 (próxima ação recomendada)? Seria uma lista tipo "to-do" do profissional? Ex.: "3 pacientes aguardando confirmação de exame", "2 checklists pendentes", "1 SLA crítico"? Ou seria dentro da ficha de cada paciente individual?

---

## C — Novo Módulo: Prontuário Clínico

### O que entendemos

Este é um módulo novo completo que transformaria o SubManager de gestor de fluxo em plataforma clínica.

---

### C.1 — Aba "Prontuário clínico" na ficha do paciente

**Entendimento:** Nova tab na ficha do paciente, separada da jornada e dos documentos operacionais.

**O que fazer:** Adicionar aba "Prontuário" no componente de detalhe do paciente. Complexidade baixa (UI).

---

### C.2 — Seções do prontuário

**Entendimento:** O prontuário teria as seguintes seções internas:

- **Anamnese estruturada** — formulário com campos clínicos (queixa principal, histórico, alergias, medicações)
- **Evolução clínica** — registro cronológico de consultas e retornos, tipo timeline
- **Exames** — upload e visualização de exames com categorização (imagens, laudos)
- **Planejamento** — registro do diagnóstico e plano de tratamento
- **Procedimentos realizados** — registro com data, equipe, técnica
- **Pós-operatório** — evolução pós-op, complicações, alta

**O que fazer:** Novo modelo de dados (`ClinicalRecord`, `ClinicalEvolution`, `ClinicalExam`, etc.) com `tenantId` + `clientId`. Reusa infraestrutura GCS existente para exames/imagens.

---

### C.3 — Separar documentos operacionais vs clínicos

**Entendimento:** Dois grupos distintos: operacionais (contratos, convênio) e clínicos (exames, imagens).

**O que fazer:** Adicionar tag/enum `documentCategory` no `FileAsset` ("operational" | "clinical"). Filtrar por categoria na UI.

---

### C.4 — Integrar prontuário com jornada

**Entendimento:** Dados clínicos podem liberar etapas automaticamente. Ex.: upload de exame atualiza status da etapa.

**O que fazer:** Depende do motor de regras (B.2). Alta complexidade. Precisaria definir quais dados clínicos disparam quais ações na jornada.

---

### C.5 — IA no prontuário

**Entendimento:** Transcrição automática de consultas, estruturação de evoluções, geração de documentos, busca inteligente.

**O que fazer:** Integração com serviço de IA externo (Whisper/STT para transcrição, LLM para estruturação e geração). Alta complexidade, requer definição de escopo.

---

### O que não entendemos — Perguntas para o cliente

---

### Modelo de anamnese

**Pergunta:** Qual é o modelo de anamnese que vocês usam hoje? É um formulário padrão da bucomaxilofacial ou cada médico tem o seu? Vocês podem enviar um modelo em branco preenchido para entendermos os campos?

---

### Evolução clínica

**Pergunta:** A evolução clínica é texto livre (tipo prontuário SOAP) ou campos estruturados? Ex.: S (Subjetivo), O (Objetivo), A (Avaliação), P (Plano)? Ou um formato diferente?

---

### Assinatura digital

**Pergunta:** Os registros do prontuário precisam de assinatura digital (CRM/CRO)? Isso impacta significativamente a arquitetura (certificado digital ICP-Brasil, carimbo de tempo).

---

### Regulatório (CFM/CFO)

**Pergunta:** Vocês precisam que o prontuário atenda a alguma resolução específica? Ex.: Resolução CFM 1.638/2002 (prontuário médico), Resolução CFO 118/2012 (prontuário odontológico). Isso define requisitos obrigatórios de campos e retenção de dados.

---

### IA no prontuário

**Perguntas:**
- **Transcrição de consultas:** vocês gravariam áudio da consulta pelo sistema ou enviariam um arquivo de áudio?
- **Geração automática de documentos:** quais documentos são prioridade? Relatório cirúrgico? Laudo? Atestado?
- **Busca inteligente:** que tipo de busca? Ex.: "pacientes com fratura de mandíbula bilateral" ou "pacientes que tomam anticoagulante"?

---

### Escopo de dados clínicos

**Pergunta:** Quais especialidades/procedimentos o prontuário precisa cobrir? Só bucomaxilofacial ou também ortodontia, implantodontia, etc.? Isso afeta os campos da anamnese e planejamento.

---

### Integração com sistemas externos

**Pergunta:** Vocês usam algum sistema de imagens (PACS/DICOM) ou laboratório que gostariam de integrar? Ex.: receber laudos de exame automaticamente.

---

### Prioridade de entrega

**Pergunta:** Qual parte do prontuário é mais urgente para vocês? Se pudéssemos entregar em fases, o que viria primeiro?
- (a) Anamnese + evolução clínica
- (b) Exames e imagens
- (c) Funcionalidades de IA
- (d) Integração com a jornada

---

## Resumo de Prioridades Sugeridas

**Fase 1 — Quick wins visuais (1-2 sprints)**
Itens A.1 a A.10. Redesign da ficha do paciente, hierarquia visual, seções colapsáveis, summary header.

**Fase 2 — Operacional básico (2-3 sprints)**
B.3 (lembretes WhatsApp), B.6 (transição contextual), B.7 (métricas dashboard), B.8 (instruções por etapa), B.10 (alertas inatividade).

**Fase 3 — Operacional avançado (3-5 sprints)**
B.1 (próxima ação), B.2 (motor de regras), B.4 (responsáveis), B.5 (templates), B.9 (bloco de ações). Depende de respostas do cliente.

**Fase 4 — Prontuário clínico (5-8 sprints)**
Módulo C completo. Depende de definição de escopo e regulatório.

---

*Documento gerado em 19/04/2026. Pendente: respostas do cliente para os itens com perguntas.*
