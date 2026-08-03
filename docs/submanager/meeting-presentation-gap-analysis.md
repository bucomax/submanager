# Análise: apresentação do sistema × código atual

Documento de alinhamento entre a **transcrição da reunião de apresentação** e o **estado do repositório** (Prisma, APIs, UI). Serve para priorizar backlog e evitar expectativa desalinhada com o que já está implementado.

**Referências internas:** `packages/prisma/schema.prisma`, `docs/ARCHITECTURE.md` (modelo e notificações), `docs/submanager/execution-plan.md` (escopo congelado de integrações).

**Plano de ação detalhado (fases, tarefas, aceite):** [`meeting-presentation-action-plan.md`](./meeting-presentation-action-plan.md).

**Atualização:** mensagens de **Anderson (31/03/2026)** consolidadas na seção 8; esclarecimento sobre **grupos/organização dentro do tenant** na seção 9. **Portal do paciente (tranche técnica):** magic link, timeline, upload com validação na ficha — refletido em §2.7 e §8.4 (abr/2026).

---

## 1. Decisões e pedidos explícitos da reunião (resumo)

| Tema | O que foi pedido / decidido |
|------|-----------------------------|
| Jornada | Criar jornadas com etapas configuráveis: nome, descrição, checklist, documentos, mensagem ao paciente, alertas por tempo na etapa. |
| Alertas | Aviso e crítico após N dias na etapa; configuráveis; destinatários devem refletir **responsável da etapa** e, no crítico, possivelmente mais pessoas. |
| Responsáveis | **Separar** responsável do **paciente** do responsável de **cada etapa**; rastreio de falhas/atrasos; notificar o próximo responsável ao avançar. |
| Editor | Visual, fluxos **não lineares** (ramificações), múltiplos parâmetros por etapa. |
| QR / link | QR e link para o paciente; compartilhamento fácil; integração com share (ex.: WhatsApp). |
| Fluxo inicial | Paciente pelo link faz **só cadastro**; escolha de jornada e mudança de etapa pelo **médico**; envio automático da primeira etapa ao WhatsApp ao entrar na jornada. |
| Motor de próxima ação | Sistema **proativo**: indicar o que falta para avançar (sub-rotinas, questionários, fotos). |
| Portal do paciente | Área logada: fases, documentos, envio de exames, evolução para assinatura, antes/depois, preferência canal (web vs WhatsApp vs ambos). |
| Motor de regras | Bloquear avanço sem pré-requisitos (ex.: termo assinado); exceção com autor + justificativa auditada. |
| Timeline / auditoria | Linha do tempo completa por paciente: quem fez o quê e quando (documentos, transições, envios). |
| Permissões | Segregação por perfil (admin vê tudo; cirurgião/ortodontista só o permitido; OPME só casos associados). |
| Assinatura / jurídico | Serviço externo (ex.: Clicksign/DocuSign); confirmação em múltiplos canais; dúvidas no documento geram alerta ao responsável da etapa. |

---

## 2. O que o código já cobre (evidências)

### 2.1 Modelo e jornada

- **`CarePathway`**, **`PathwayVersion`** com `graphJson`, **`PathwayStage`** materializado (`stageKey`, `name`, `sortOrder`, `patientMessage`, `alertWarningDays`, `alertCriticalDays`).
- **`PathwayStageChecklistItem`** + **`PatientPathwayChecklistItem`** (progresso por paciente, com `completedByUserId` opcional).
- **`StageDocument`** (pacote de arquivos por etapa, sincronizado na publicação).
- **`PatientPathway`** com `enteredStageAt` (base para “dias na etapa” e SLA).
- **`StageTransition`** com `actorUserId`, `note`, **`dispatchStub`** (snapshot do bundle — **não** há tabela `ChannelDispatch` nem HTTP real ao chatbot; ver `docs/ARCHITECTURE.md`).

### 2.2 Editor visual e ramificações

- Editor com **`@xyflow/react`** (`pathway-editor.tsx`) + utilitários de grafo (`pathway-graph.ts`, `linear-graph-edges.ts`).
- Publicação persiste estágios e metadados de SLA no `PathwayStage` (`publish/route.ts`).

### 2.3 Alertas (SLA)

- Cálculo de saúde SLA: `src/lib/pathway/sla-health.ts`.
- UI no Kanban e APIs de dashboard usam `alertWarningDays` / `alertCriticalDays`.
- Notificações in-app `sla_warning` / `sla_critical` via `checkAndEmitSlaNotifications` (`sla-notification-check.ts`), com deduplicação por janela de 24h.

### 2.4 Responsável “do paciente” (não por etapa)

- **`Client.assignedToUserId`** → relacionamento `assignedTo` (usuário responsável pelo **cliente**, não por etapa da jornada).
- Não existe no schema campo de **responsável por `PathwayStage`** nem **responsável atual por etapa** em `PatientPathway`.

### 2.5 Notificações in-app

- Modelo **`Notification`**, tipos em `NotificationType` (`stage_transition`, `new_patient`, `checklist_complete`, SLA, etc.).
- Emissão padrão (`notification-emitter.ts`): sem `targetUserIds`, notifica **todos os membros do tenant**; flags do tenant filtram tipos ligados a `notifyCriticalAlerts` / `notifyNewPatients`.
- **Gap da reunião:** não há roteamento para “só o responsável da etapa” nem lista de escalação configurável para crítico.

### 2.6 QR e link (cadastro público)

- **`PatientSelfRegisterInvite`** (token, expiração, uso único).
- UI: `PatientSelfRegisterQrDialog` (QR + copiar link) na lista de clientes.
- **Gap da reunião:** o fluxo descrito mistura “após criar paciente **e** escolher jornada, gerar QR/link **daquele** paciente”. Hoje o convite é **genérico da clínica** para auto-cadastro, não um deep link pós-`PatientPathway` com token por caso.

### 2.7 Portal do paciente

- Página pública de **auto-cadastro** (`patient-self-register-page` + validators em `client.ts`).
- **Portal web (sessão própria, sem NextAuth staff):** `PatientPortalLinkToken` → `POST /api/v1/public/patient-portal/exchange` → cookie `patient_portal_session`. UI `/patient`, `/patient/enter`; staff gera link em `POST /api/v1/clients/:id/portal-link`.
- **No portal:** resumo da clínica e da jornada ativa (`GET /api/v1/patient/overview`), **linha do tempo** somente leitura com payload sanitizado (`GET /api/v1/patient/timeline`), **documentos** — listagem, upload via presign e registro com `PatientPortalFileReviewStatus` **PENDING** até a equipe **aceitar ou recusar** na ficha (`PATCH /api/v1/clients/:clientId/files/:fileId/review`); download pelo paciente só após **APPROVED** ou arquivo da clínica (`NOT_APPLICABLE`). Eventos `PATIENT_PORTAL_FILE_*` e `FILE_UPLOADED_TO_CLIENT` entram na timeline agregada.
- **Ainda não (vs. visão completa da reunião):** conta própria do paciente (`PatientAccount`), login com OTP/e-mail para **validade jurídica**, assinatura de termos no portal, escolha explícita de canal (web vs WhatsApp), formulários dinâmicos e módulo de “orientações” além do texto de etapa/jornada.

### 2.8 RBAC

- **`TenantRole`:** `tenant_admin` e `tenant_user` apenas.
- **`Client.opmeSupplierId`** para associação OPME ao paciente.
- **Gap da reunião:** perfis granulares (cirurgião vs ortodontista vs fornecedor com visibilidade só dos próprios casos) **não** estão modelados como papéis distintos nem com regras de filtro em listagens/Kanban além do que `assignedTo` / OPME permitem implicitamente.

### 2.9 Auditoria / timeline

- **`AuditEvent`** por cliente (`STAGE_TRANSITION`, `FILE_UPLOADED_TO_CLIENT`, `SELF_REGISTER_COMPLETED`, **`PATIENT_PORTAL_FILE_*`**) + merge na API/UI com **`StageTransition`** legado deduplicado (`buildClientTimelinePage`).
- Também: **`PatientNote`**, conclusões de checklist com autor, soft delete com `deletedByUserId`.
- **Gap da reunião:** ainda **não** há linha única cobrindo **todos** os tipos desejados na reunião (ex.: assinatura, visualização de documento, exceção de regra como evento dedicado, disparo real ao canal como registro na mesma visão).

### 2.10 Motor de regras e assinatura

- Transição de etapa **não** valida documentos assinados nem checklist obrigatório no servidor além das regras já existentes (etapa válida na versão, paciente não concluído, etc.).
- Nenhuma integração com provedor de assinatura eletrônica no código.

---

## 3. Matriz rápida: reunião × implementação

| Demanda da reunião | Status no código | Comentário |
|--------------------|------------------|------------|
| Jornada + etapas + checklist + docs + mensagem | ✅ | Núcleo entregue. |
| Alertas 10d / 30d (exemplo) | ✅ config / 🟨 destinatários | Dias por etapa OK; notificação não vai só ao responsável da etapa. |
| Responsável **por etapa** (template + instância) | ❌ | Só `Client.assignedToUserId`. |
| Notificar próximo responsável na transição | ❌ | `stage_transition` vai a todos (ou subset se `targetUserIds` for usado no futuro). |
| Editor visual + ramificações | ✅ | React Flow + publicação. |
| QR + link | 🟨 | Convite de **auto-cadastro**; não “link do paciente X na jornada Y”. |
| Share WhatsApp | ❌ | Só copiar link manualmente. |
| Paciente só cadastro; médico move etapas | 🟨 | Cadastro público existe; “médico controla” é fluxo de produto na UI já alinhado; envio automático WhatsApp = **fora** (stub). |
| Motor de próxima ação | ❌ | Melhoria de UX/agregação de estado; não há engine nomeada. |
| Portal do paciente completo | ❌ | Fora do escopo atual. |
| Motor de regras + override auditado | ❌ | |
| Timeline única auditável | 🟨 | Fragmentos; sem modelo único. |
| RBAC por perfil clínico/OPME | 🟨 | Papéis grosseiros + OPME no cliente. |
| Assinatura eletrônica + dúvidas no doc | ❌ | Pesquisa de fornecedor foi action item na reunião. |

Legenda: ✅ atende de forma útil · 🟨 parcial · ❌ não atende.

---

## 4. Backlog sugerido (organizado para execução)

Agrupado por dependência e alinhado ao que o schema/API já permitem. Itens que tocam **WhatsApp real** ou **assinatura terceira** dependem de reabrir integrações (`execution-plan.md`).

### Onda A — Responsabilidade por etapa e notificações (alto impacto na reunião)

1. **Modelo de dados**
   - Opcional no template: `PathwayStage.defaultAssigneeUserId` (ou role futuro).
   - Na instância: `PatientPathway.currentStageAssigneeUserId` **ou** tabela `PatientStageAssignment` (histórico por etapa — melhor para auditoria “quem era o responsável quando falhou”).
2. **Editor de jornadas** — seletor de responsável padrão por nó/etapa (persistir no `graphJson` + colunas no publish).
3. **APIs** — ao criar `PatientPathway` ou ao transicionar: definir assignee (regra: herdar do template, permitir override na UI).
4. **`notificationEmitter`** — para `sla_*` e `stage_transition`: `targetUserIds` = assignee(s) da etapa; crítico opcionalmente + `tenant_admin` ou lista configurável no tenant/etapa.
5. **UI** — exibir responsável da etapa no Kanban e na ficha do paciente.

### Onda B — QR / link e compartilhamento

1. **Decisão de produto:** manter convite genérico **e/ou** adicionar token por `clientId` / `patientPathwayId` (pré-cadastro vs pós vínculo com jornada).
2. **Share:** `navigator.share` quando disponível + fallback “Copiar” + deep link `whatsapp://` com texto pré-preenchido (sem depender de API Meta).

### Onda C — Motor de próxima ação (UX)

1. Agregar na ficha do paciente: checklist pendente da etapa + documentos obrigatórios não anexados (quando houver regra) + SLA atual.
2. Endpoint ou projeção read-only “próximos passos” para o dashboard.

### Onda D — Regras de transição e auditoria

1. Definir pré-requisitos por etapa (ex.: checklist mínimo, flag “documento X assinado” — quando existir integração).
2. Tabela **`AuditEvent`** (ou similar): `tenantId`, `clientId`, `actorUserId`, `action`, `payload`, `createdAt`; gravar transições, uploads, overrides.
3. UI timeline consumindo eventos unificados + dados existentes (`StageTransition`).

### Onda E — Portal do paciente e assinatura (projeto maior)

1. Autenticação do paciente (fluxo separado do staff).
2. Telas: fases somente leitura, upload, status de documentos.
3. Integração com provedor de assinatura (action item da reunião: pesquisa jurídica + técnica).
4. Fluxo “tenho dúvida nesta cláusula” → notificação ao assignee da etapa.

### Onda F — RBAC fino

1. Estender `TenantRole` ou introduzir **capabilities** / escopo por usuário (ex.: “vê apenas `assignedToUserId = eu`” para `tenant_user`).
2. Filtrar `GET` de clientes/Kanban conforme papel; OPME: já existe vínculo no `Client` — reforçar políticas nas queries.
3. **Opcional (se produto confirmar modelo “equipe”):** entidade tipo `CareTeam` / `PracticeUnit` (médico referência + membros) e `Client.teamId` ou matriz de visibilidade — só necessário se a regra for “secretária do Dr. A nunca vê pacientes do Dr. B” por **vínculo de equipe**, não só por `assignedTo`. Ver seção 9.

---

## 5. Itens da ata × responsáveis (rastreio)

| Ação na transcrição | Proposta no código |
|---------------------|-------------------|
| Anderson — responsável por etapa | Onda A (schema + editor + APIs + notificações). |
| Anderson — responsáveis no editor | Mesmo pacote A. |
| Anderson — share (WhatsApp) | Onda B. |
| Pesquisa assinatura eletrônica | Onda E + decisão jurídica fora do repo. |
| Resumo para Anderson / Saulo | Este documento + `execution-plan` para cortes de escopo. |

---

## 6. Riscos de expectativa

1. **“Envio automático ao WhatsApp na primeira etapa”** — hoje só há **`dispatchStub`**; integração real está **congelada** no plano de execução até decisão explícita.
2. **“Alertas para o responsável da etapa”** — sem assignee por etapa, o sistema notifica o **tenant inteiro** (respeitando flags), o que não reproduz a discussão da reunião.
3. **QR após escolha da jornada** — o produto atual enfatiza **convite de cadastro** na lista de pacientes, não um artefato por `PatientPathway`.

---

## 7. Próximo passo recomendado

Validar com produto a **Onda A** como primeira entrega pós-reunião (maior aderência ao discurso de responsabilização e alertas), em seguida **B** (share e refinamento de links) e **C** (próxima ação na UI). Ondas **D–F** podem ser fatiadas conforme prazo e reabertura de integrações.

---

## 8. Especificação adicional (Anderson, 31/03/2026)

Texto recebido por mensagem, alinhado ao que já estava na ata e ao código. Cada bloco indica **cobertura atual** (referência às seções 2–3).

### 8.1 Engine de fluxos customizados (jornadas)

| Pedido | Notas vs código |
|--------|-----------------|
| Fluxos não lineares por procedimento | ✅ Grafo + `CarePathway` por tenant. |
| **Templates** pré-definidos + admin cria/edita | 🟨 Vários `CarePathway` por tenant; **catálogo de templates de plataforma** (`PathwayTemplate` na doc de domínio) **não** existe no Prisma — só jornadas do próprio tenant. |
| Etapa: nome, descrição | 🟨 Nome e mensagem ao paciente existem; **descrição longa da etapa** para staff não está explícita como campo dedicado (pode estar só no editor/node). |
| Checklist obrigatório | 🟨 Itens de checklist existem; **obrigatoriedade para transição** não é enforcement no servidor (ver 8.3). |
| SLA (comum + crítico) | ✅ `alertWarningDays` / `alertCriticalDays`. |
| Mensagens automáticas (WhatsApp/e-mail) na entrada | 🟨 `patientMessage` + stub; envio real congelado no plano de execução. |
| **Responsável padrão** (cargo/usuário) por fase | ❌ Ver Onda A. |

### 8.2 Segregação de visão e permissões

| Pedido | Notas vs código |
|--------|-----------------|
| Admin “master” vê tudo e delega permissões | 🟨 `tenant_admin` vê tenant; **matriz fina de permissões** não existe. |
| Cirurgiões internos: próprios + sócios (se admin permitir) | ❌ Não há papéis “cirurgião” nem flag “pode ver casos dos sócios X, Y”. |
| Parceiros (ortodontista, OPME): só casos **atribuídos** | 🟨 `opmeSupplierId` no `Client`; ortodontista como usuário com escopo = depende de RBAC (Onda F). |
| Dashboard: alertas e atrasos só da “área de responsabilidade” | ❌ SLA/notificações hoje para o tenant inteiro (ou `targetUserIds` pontual); sem filtro por escopo. |

### 8.3 Motor de regras e próxima ação

| Pedido | Notas vs código |
|--------|-----------------|
| Bloquear avanço sem checklist/assinaturas | ❌ Transição não valida conclusão de checklist nem documentos assinados. |
| Exceção com **justificativa** persistida | 🟨 `StageTransition.note` existe; **não** há fluxo UX “só avança com motivo se regra falhar” nem tipo de evento `RULE_OVERRIDE`. |
| Guiar “próxima ação” | ❌ Ver Onda C. |

### 8.4 Portal do paciente

| Pedido | Notas vs código |
|--------|-----------------|
| Onboarding link/QR | 🟨 Convite de **auto-cadastro** (QR/link genérico da clínica); **portal** usa **magic link** por paciente (`portal-link`), não o mesmo fluxo. |
| Login com validação (e-mail/WhatsApp) para validade jurídica | 🟨 **Sessão por magic link + cookie** dedicado; **sem** conta/senha nem OTP — não atende critério jurídico “forte” até `PatientAccount` ou fluxo explícito. |
| Linha do tempo macro, fase atual, próximas | 🟩 **Parcial:** resumo de jornada/etapa atual no `/patient` + timeline de eventos (LGPD); **sem** motor de “próxima ação” nem lista guiada de próximos passos além do copy da jornada. |
| Upload, formulários, orientações | 🟨 **Upload** de arquivos com **fila de validação** na ficha (aceitar/recusar); **sem** formulários estruturados no portal nem módulo dedicado de orientações (além de mensagens de etapa/jornada no painel). |

### 8.5 Fluxo de assinaturas (TCLE/contratos) e dúvidas

| Pedido | Notas vs código |
|--------|-----------------|
| Leitura cadenciada (checkboxes ao longo do texto) | ❌ |
| Imprimir / PDF antes de aceitar | ❌ |
| “Tenho dúvida” + texto + trava assinatura + alerta clínica | ❌ |
| ClickSign/ZapSign vs log interno (advogado) | ❌ Decisão externa + Onda E. |

### 8.6 Timeline e auditoria

| Pedido | Notas vs código |
|--------|-----------------|
| Todo evento na linha do tempo | 🟨 Parcial: `AuditEvent` na ficha (transição, arquivo staff, auto-cadastro, **envio/aprovação/recusa** pelo portal) + transições legado deduplicadas; notas e checklist com autor em outras UIs; ainda **sem** assinaturas, disparo real ao WhatsApp como evento, etc. |
| Autoria + timestamp em tudo | 🟨 Uploads na ficha e ciclo portal (**SUBMITTED/APPROVED/REJECTED**) geram auditoria com timestamp; staff identificado quando aplica; envio pelo paciente sem `User` (`actor` nulo). **Incompleto** para assinaturas, envios ao canal, visualização de documento, exceções de regra como evento único. |

### 8.7 Adendos Anderson (produto)

| Adendo | Notas vs código |
|--------|-----------------|
| **Responsável passado / presente / futuro** (gargalo) | ❌ Exige modelo de assignee por etapa + histórico (Onda A) e UI tri-state. |
| **Dupla confirmação** e-mail + WhatsApp para críticos | ❌ Depende de integrações e portal/identidade do paciente. |
| Escolha portal vs WhatsApp para trâmite | ❌ |
| **Auditoria de sessão** (login/logout, perfil) | 🟨 NextAuth/session existe; **log de auditoria de acesso** dedicado (IP, horário, papel) não é requisito implementado como tabela de eventos. |
| Contexto “secretária” (informação descentralizada no painel) | 🟨 Kanban/jornada ajudam; falta RBAC + responsáveis por etapa + timeline completa para cumprir a promessa. |

---

## 9. Grupos / organização dentro do tenant (pergunta explícita)

**Pergunta:** Nas transcrições, falou-se que **cada tenant teria uma organização ou grupo** (ex.: médico responsável + secretárias para um lado; outro médico e equipe para outro; um não vê o que o outro tem)?

**Resposta com base apenas no texto que temos:**

- **Não consta** essa formulação explícita (“grupo”, “organização interna”, “equipe do médico A com secretárias” como unidade de visibilidade).
- **O que consta** e é **compatível** com um desenho futuro em equipes:
  - **Segregação por perfil** (admin vê tudo; demais com escopo menor).
  - **Sócios** podem ver casos uns dos outros **se o administrador permitir**; um **terceiro** cirurgião veria **só os dele** (transcrição da apresentação).
  - **Parceiros externos** (ortodontista, OPME) só o que foi **explicitamente atribuído** (apresentação + texto Anderson).
  - **Dashboard e alertas** “da sua área de responsabilidade” (Anderson) — isso **implica** algum critério de escopo (atribuição, papel, ou equipe), mas **não nomeia** o critério como “grupo organizacional”.

**Conclusão para produto:** o combinado oral pode ter sido **equipes na cabeça de alguém**, mas no material escrito vigente a regra é **atribuição + papel + liberação do admin (sócios)**. Se a clínica precisa de **“secretária do Dr. A não vê Dr. B”** sem depender só de `Client.assignedToUserId`, isso é um **requisito a confirmar** e provavelmente exige modelo **`CareTeam`** (ou similar) na **Onda F**, além de filtros em todas as listagens.

---

*Gerado a partir da transcrição fornecida e da leitura do repositório SubManager; revisar após mudanças em schema ou `execution-plan.md`.*
