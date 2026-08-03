# SubManager — lógica de negócio consolidada

Este documento resume a **regra de negócio efetiva** que hoje governa cadastro de pacientes, jornada clínica, documentos por etapa e responsabilidades no tenant. Ele complementa `ARCHITECTURE.md` (§8), `execution-plan.md` e `persistence-api-and-transitions.md`.

---

## 1. Princípios transversais

- Todo dado clínico/cadastral é **escopado por `tenantId`**.
- Toda operação de negócio protegida usa **tenant ativo** e deve aceitar apenas usuário com **membership válida** no tenant, exceto `super_admin` em contexto explícito.
- O backend é a fonte de verdade: UI pode orientar, mas não decide permissão nem integridade de fluxo.
- Arquivos clínicos ficam em `FileAsset` (R2) e downloads usam **URL assinada de curta duração**.

---

## 2. Paciente (`Client`)

### Campos operacionais atuais

- Obrigatórios no cadastro:
  - `name`
  - `phone`
  - `documentId`
- Opcionais:
  - `email`
  - `caseDescription`
  - `assignedToUserId`
  - `opmeSupplierId`

### Regras

- `assignedToUserId` só pode apontar para usuário com **`TenantMembership` ativa** no mesmo tenant.
- `opmeSupplierId` só pode apontar para `OpmeSupplier` **ativa** do mesmo tenant.
- `deletedAt != null` significa **soft delete**; listagens e detalhes não devem exibir esse paciente.

---

## 3. Jornada do paciente (`PatientPathway`)

### Entrada na jornada

1. O paciente é criado no tenant.
2. O usuário escolhe uma `CarePathway` publicada.
3. O backend resolve a **versão publicada mais recente**.
4. O paciente entra na **primeira etapa** (`sortOrder` ascendente).
5. O sistema grava:
   - `PatientPathway`
   - `StageTransition` inicial (`fromStageId = null`)
   - `dispatchStub` com snapshot do pacote de documentos da etapa inicial

### Regras

- Um `Client` só pode ter **uma** `PatientPathway` ativa no modelo atual.
- A jornada sempre aponta para uma **`PathwayVersion` publicada**.
- `enteredStageAt` é atualizado sempre que a etapa atual muda.

---

## 4. Transição de etapa

### Regra atual

- `toStageId` deve pertencer ao mesmo `pathwayVersionId` do paciente.
- Não é permitido transicionar para a **mesma** etapa atual.
- A transição é salva em transação com:
  - `StageTransition`
  - atualização de `PatientPathway.currentStageId`
  - atualização de `enteredStageAt`

### Pacote de documentos

- Cada `PathwayStage` pode ter vários `StageDocument`.
- `StageDocument` referencia `FileAsset` e possui `sortOrder`.
- Ao iniciar jornada ou mudar de etapa, o backend monta o bundle ordenado de documentos da etapa de destino e o salva em `dispatchStub.documents`.

### Observações atuais

- O snapshot hoje serve para **auditoria e preview**, não para envio real ao WhatsApp.
- Ainda não existe `ChannelDispatch` persistido nem integração real de canal nesta fatia.

---

## 5. Documentos

### `FileAsset`

- Representa metadados de arquivo já enviado ao R2.
- Pode estar vinculado diretamente a um paciente (`clientId`) para histórico/consulta.

### `StageDocument`

- Representa arquivo do **pacote de uma etapa**.
- Regras:
  - só pode referenciar etapa **publicada** do tenant
  - só pode referenciar `FileAsset` do mesmo tenant
  - o mesmo arquivo não pode ser associado duas vezes à mesma etapa (`@@unique([pathwayStageId, fileAssetId])`)

---

## 5.1 Checklist por etapa

- `PathwayStageChecklistItem` materializa os itens operacionais configurados na etapa publicada.
- A fonte de verdade de edição fica no `graphJson` da jornada em rascunho; ao publicar, os itens são sincronizados para a etapa materializada.
- `PatientPathwayChecklistItem` guarda o progresso por paciente.
- Regras atuais:
  - o toggle só pode ocorrer para item da **etapa atual** do paciente
  - o item precisa pertencer à mesma `PathwayVersion` da jornada do paciente
  - desmarcar limpa `completedAt` e `completedByUserId`

---

## 6. Responsável e OPME

### Responsável

- É um vínculo leve entre `Client` e `User`.
- Serve para organização operacional, não altera permissão clínica por si só.

### Fornecedor OPME

- `OpmeSupplier` é catálogo por tenant.
- Pode ser criado por `tenant_admin` ou `super_admin`.
- O paciente referencia no máximo um fornecedor OPME atual.

---

## 6.1 Notas dedicadas

- `PatientNote` guarda anotações clínicas/operacionais separadas de `caseDescription`.
- `caseDescription` continua sendo o **resumo** do caso; `PatientNote` vira o **histórico cronológico**.
- Regras atuais:
  - toda nota pertence a um `tenantId` e a um `clientId`
  - toda nota registra `authorUserId`
  - a listagem é paginada e ordenada por `createdAt desc`

---

## 7. SLA e listagens

- SLA do paciente é derivado de:
  - `enteredStageAt`
  - `alertWarningDays`
  - `alertCriticalDays`
- Quando o filtro por status SLA está ativo, o backend percorre os pacientes em lotes para retornar:
  - página correta
  - `totalItems` correto
  - `hasNextPage` correto

---

## 8. Decisões de produto já assumidas no código

- A ficha do paciente concentra:
  - descrição do caso
  - anotações dedicadas
  - checklist da etapa atual
  - arquivos do paciente
  - contato/gestão (e-mail, responsável, OPME)
  - linha do tempo (`AuditEvent` + transições sem par em audit; ver `GET /api/v1/clients/:id/timeline`)
  - transição com preview do pacote documental
- O modal de transição mostra o **pacote completo da etapa de destino**, não só observação textual.
- A busca da lista de pacientes considera **nome, telefone e e-mail**.

---

## 9. Auto-cadastro do paciente (`PatientSelfRegisterInvite`)

### Fluxo atual

1. Staff cria convite: `POST /api/v1/clients/self-register-invites` (token 64-char hex, TTL 48h).
2. Paciente acessa URL `/{tenantSlug}/patient-self-register?token=...`.
3. Formulario coleta: dados pessoais, data de nascimento (opcional), canal preferido, contato de emergencia (opcional), endereco, responsavel com parentesco e e-mail (se menor), senha, consentimentos.
4. Backend cria/atualiza `Client`, marca invite como usado, emite audit events.
5. Notifica staff (in-app + e-mail) e paciente (e-mail de boas-vindas).
6. **Nao** atribui jornada automaticamente — staff escolhe no painel.

### Campos coletados

| Campo | Obrigatorio | Observacao |
|-------|-------------|------------|
| `name` | sim | |
| `phone` | sim | |
| `email` | nao | |
| `documentId` (CPF) | adulto sim, menor nao | |
| `isMinor` | sim (checkbox) | |
| `guardianName` | se menor | |
| `guardianDocumentId` (CPF) | se menor | |
| `guardianPhone` | nao | |
| `guardianEmail` | nao | Menor: opcional; notificacoes quando distinto do e-mail do paciente |
| `guardianRelationship` | se menor | Enum: mae, pai, tutor legal, outro |
| `birthDate` | nao | AAAA-MM-DD |
| `emergencyContactName` / `emergencyContactPhone` | nao | Par opcional; se um preenchido, o outro exigido (validacao) |
| `preferredChannel` | nao | `email` \| `whatsapp` \| `sms` \| `none` (default `none`) |
| Endereco completo | nao | CEP, logradouro, numero, complemento, bairro, cidade, UF |
| `password` + confirmacao | sim | min 8 chars, maiuscula, minuscula, digito, especial |
| `acceptTerms` | sim | |
| `acceptPrivacy` | sim | LGPD |

### Validacao menor/responsavel

- `isMinor = true`: CPF do paciente e opcional, `guardianName` + `guardianDocumentId` + `guardianRelationship` obrigatorios.
- `isMinor = false`: CPF do paciente obrigatorio (11 digitos).
- Login no portal aceita CPF do paciente **ou** CPF do responsavel (menor).

### Gaps identificados

#### P0 — Impacto direto no uso

| # | Gap | Status |
|---|-----|--------|
| 1 | Indicador de menor na lista | **Feito** — badge na coluna nome (`ClientsList`). |
| 2 | Indicador de menor no header da ficha | **Feito** — badge ao lado do nome (`ClientDetailView`). |
| 3 | Notificacoes ao responsavel (menor) | **Parcial** — revisao de arquivo (`notifyPatientFileReviewed`): e-mail e WhatsApp tambem para `guardianEmail` / `guardianPhone` quando distintos do paciente; OTP do portal (`otp/request`): segundo e-mail e webhook WhatsApp para o responsavel nas mesmas condicoes. Demais eventos (ex.: transicao de etapa) ainda nao duplicados. |

#### P1 — Melhorias planejadas

| # | Gap | Descricao | Esforco |
|---|-----|-----------|---------|
| 4 | **Sem upload de documentos durante o cadastro** | Paciente precisa voltar ao portal depois para enviar arquivos (exames, laudos). Formulario de cadastro poderia ter etapa de upload | Medio |
| 5 | **Sem lembrete de atribuicao de jornada** | Apos cadastro, nenhum lembrete automatico para o staff atribuir jornada. Paciente pode ficar "solto" | Medio — notificacao agendada (ex.: 24h sem jornada) |
| 6 | **Sem data de nascimento** | ~~Usa flag `isMinor` mas nao calcula idade~~ | **Feito** — `Client.birthDate` (`@db.Date`), formulario publico + painel (PATCH). |
| 7 | **Sem campo de parentesco** | ~~`guardianName` existe mas nao ha campo indicando a relacao~~ | **Feito** — `Client.guardianRelationship` + UI. |
| 8 | **Sem login proxy do responsavel** | Responsavel nao tem conta propria; acessa o portal do menor com o CPF do menor. Idealmente teria painel proprio | Grande |
| 9 | **Contato de emergencia ausente** | ~~Nao ha campo de contato de emergencia separado do responsavel~~ | **Feito** — `emergencyContactName` / `emergencyContactPhone`. |
| 10 | **Sem preferencia de canal** | ~~Nao ha campo indicando se paciente prefere e-mail, SMS ou WhatsApp~~ | **Feito** — `Client.preferredChannel`. |

#### P2 — Futuro / decisao de produto

| # | Gap | Descricao |
|---|-----|-----------|
| 11 | Jornada auto-atribuida quando tenant tem fluxo unico | Hoje e manual mesmo com 1 fluxo; poderia ser automatico |
| 12 | Termos e politica versionados com aceite rastreavel | Audit event registra versao, mas nao ha tela para staff ver historico de aceites |
| 13 | Convite por WhatsApp alem de QR/link | Enviar link de auto-cadastro direto pelo WhatsApp da clinica |

---

## 10. Gaps gerais

- `ChannelDispatch` real com status/erro/retry.
- Decisao formal se a transicao pode ir para **qualquer etapa da versao** ou apenas etapas adjacentes no fluxo.
- Regras de migracao de pacientes entre versoes publicadas.

---

## 11. Referencias

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-SCOPE.md`
- `docs/submanager/execution-plan.md`
- `docs/submanager/persistence-api-and-transitions.md`
