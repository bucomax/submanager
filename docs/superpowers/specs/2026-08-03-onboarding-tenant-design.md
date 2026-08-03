# Spec C — Onboarding de novo tenant

**Data:** 2026-08-03
**Status:** aprovado, aguardando implementação
**Depende de:** nada. Compartilha o Vitest configurado na Task 1 de `plans/2026-08-03-whatsapp-templates.md`.

---

## Problema

Hoje existe **criação de registro, não onboarding**.

`runCreateTenant` grava sete campos (`name`, `slug`, `taxId`, `phone`, `addressLine`, `city`, `postalCode`) e opcionalmente convida o primeiro administrador. Todo o resto nasce desligado: `whatsappEnabled: false`, `emailOutboundMode: platform`, `smtpEnabled: false`, zero `CarePathway`, zero `OpmeSupplier`, nenhum membro além do admin.

O `tenant_admin` faz o primeiro login e encontra um painel sem jornada nenhuma. Para cadastrar o primeiro paciente ele precisa desenhar um fluxo do zero no editor XYFlow — a parte mais difícil do produto — sem nenhuma orientação.

### Estado verificado

Levantamento em 2026-08-03, contra o código:

| Afirmação | Verdade |
|---|---|
| Wizard de criação de 4 etapas | **Existe.** `create-tenant-wizard-dialog.tsx`. `docs/TENANT-CREATION-IMPROVEMENT.md` está concluído |
| `PathwayTemplate` (catálogo de jornadas da plataforma) | **Não existe.** Citado em `.claude/rules/multi-tenant-journey.md`, em `application-layer.md` (use case `ClonePathwayFromTemplate`) e em `PRODUCT-SCOPE.md`, mas ausente do schema e de todo o código. Já registrado em `docs/bucomax/meeting-presentation-gap-analysis.md:199` |
| Endereço do tenant perde dados no wizard | **Falso.** `mergeTenantAddressLine` concatena rua, número, complemento e bairro em `addressLine`, e cidade + UF em `city` como `"São Paulo · SP"`. Nada é perdido, mas o resultado é string não parseável — limitação conhecida, fora deste escopo |
| Envio de e-mail sem passar pelo Resend | **Existe.** `emailOutboundMode: "smtp"` usa Nodemailer direto em `sendEmailViaSmtp` |
| Nome do remetente configurável no modo padrão | **Não.** No modo `platform`, `resolveTenantSender` devolve `process.env.EMAIL_FROM` inteiro, nome incluído |

---

## Decisões

| # | Decisão | Escolha |
|---|---|---|
| 1 | Quem conduz o onboarding | O `tenant_admin`, por checklist no painel. As credenciais de WhatsApp e SMTP são da clínica — o `super_admin` não as tem |
| 2 | Origem do primeiro fluxo | Catálogo `PathwayTemplate` curado pela plataforma, clonado pela clínica |
| 3 | Estado do checklist | Derivado do estado real; só a dispensa dos opcionais é persistida |
| 4 | Passo 0 (dados da clínica) | Exibe o que o `super_admin` já cadastrou, editável. Só conta como concluído com CNPJ e telefone preenchidos |
| 5 | Nome de exibição do remetente | Passa a ser configurável também no modo `platform` |
| 6 | Padrão dos guias | Reusa o formato de `email-events-info-dialog.tsx`, que já existe |

---

## Modelo de dados

### Catálogo de modelos de jornada

```prisma
model PathwayTemplate {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?  @db.Text
  /** Agrupa e filtra o catálogo: "bucomaxilofacial", "implantodontia". */
  specialty   String?
  isPublished Boolean  @default(false)
  sortOrder   Int      @default(0)
  /** Mesmo formato de PathwayVersion.graphJson — a clonagem é cópia direta. */
  graphJson   Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  stages      PathwayTemplateStage[]

  @@index([isPublished, specialty, sortOrder])
}

model PathwayTemplateStage {
  id             String          @id @default(cuid())
  templateId     String
  template       PathwayTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  stageKey       String
  name           String
  sortOrder      Int
  slaHours       Int?
  patientMessage String?         @db.Text
  /**
   * Itens do checklist da etapa, com `requiredForTransition`.
   * Json porque só são lidos na clonagem, nunca consultados isoladamente.
   * Validado por schema Zod na escrita.
   */
  checklistItems Json?

  @@unique([templateId, stageKey])
  @@index([templateId, sortOrder])
}
```

**Restrição que define o escopo:** `StageDocument` liga a `FileAsset`, que tem `tenantId`. Um modelo da plataforma **não pode trazer arquivos** — clona apenas estrutura: etapas, ordem, SLA, checklist e mensagem ao paciente. A clínica anexa os documentos dela depois.

Copiar objeto do GCS entre a plataforma e o tenant é possível (`PLATFORM_TENANT_ID` já existe para ícones de app), mas é escopo próprio e não bloqueia o onboarding.

### Dispensa de itens do checklist

```prisma
model Tenant {
  // ...
  /**
   * Chaves de itens de onboarding que a clínica mandou sumir do painel.
   * Itens obrigatórios (`company`, `pathway`) nunca entram aqui.
   */
  onboardingDismissed String[] @default([])
}
```

### Especialidade da clínica

```prisma
model Tenant {
  // ...
  /** Filtra o catálogo de modelos no checklist. Null = mostra tudo. */
  specialty String?
}
```

Capturada na etapa 1 do wizard de criação.

---

## Os seis passos

Card no topo de `/dashboard`, que desaparece quando os obrigatórios estão concluídos e os opcionais estão concluídos ou dispensados. Sem tela nova, sem bloqueio de acesso.

Enquanto não há fluxo publicado, o card assume o lugar das métricas vazias.

| # | Passo | Concluído quando | Peso |
|---|---|---|---|
| 0 | Dados da clínica | `taxId` **e** `phone` preenchidos | obrigatório |
| 1 | Fluxo inicial | existe `CarePathway` com versão publicada | obrigatório |
| 2 | E-mail | `emailFromName` preenchido (qualquer modo) | recomendado, dispensável |
| 3 | WhatsApp | `whatsappVerifiedAt` preenchido | opcional, dispensável |
| 4 | Equipe | `memberships > 1` | opcional, dispensável |
| 5 | Fornecedor OPME | existe `OpmeSupplier` | opcional, dispensável |

Preencher só o nome do remetente conclui o passo 2 de propósito: com a mudança da seção seguinte, o modo `platform` passa a funcionar assinado pela clínica sem mais nenhuma configuração. Quem quiser domínio próprio ou SMTP segue adiante; quem não quiser já está servido.

### Passo 0 — Dados da clínica

Não é formulário em branco: exibe o que o `super_admin` já cadastrou, editável, com o que falta destacado. É conferência.

CNPJ e telefone são exigidos para concluir porque clínica sem eles trava emissão de documento depois, e o problema aparece no pior momento. Não bloqueia o uso do sistema — o item apenas continua pendente.

Campo novo aqui: `affiliatedHospitals`, que existe no modelo e não está em nenhuma tela. Para bucomaxilofacial, onde a cirurgia acontece em hospital conveniado, é informação de operação.

### Passo 1 — Fluxo inicial

Lista os `PathwayTemplate` publicados, filtrados por `Tenant.specialty`, mais a opção de começar do zero.

Clonar cria `CarePathway` → `PathwayVersion` **já publicada** → `PathwayStage[]` → `PathwayStageChecklistItem[]`. Publicada porque o modelo é curado e deixar em rascunho obrigaria a clínica a descobrir sozinha o passo de publicar — que é o que o checklist existe para evitar.

Catálogo vazio não trava: o passo oferece "criar do zero" e aponta para o editor.

### Passo 2 — E-mail

Os três modos apresentados lado a lado:

| Modo | Remetente | Passa pelo Resend | Exige | Prazo |
|---|---|---|---|---|
| `platform` (padrão) | `Sua Clínica <remetente-da-plataforma>` | sim | nada | imediato |
| `smtp` | o e-mail que a clínica já usa | **não** | senha de app | minutos |
| `resend_domain` | `contato@suaclinica.com.br` | sim | acesso ao DNS | até 48h |

Precedência já implementada em `resolveTenantSender`: `smtp` completo vence `resend_domain` verificado, que vence `platform`.

O campo de **nome do remetente** aparece nos três modos.

### Passos 3 a 5

WhatsApp, equipe e OPME. Cada um abre a tela de configuração que já existe, com o guia correspondente. Convite de membro reusa `team-invite-user-dialog.tsx`.

OPME está no checklist porque destrava a visibilidade por fornecedor (`linkedOpmeSupplierId`), que é invisível para quem não sabe que existe.

---

## Nome do remetente no modo plataforma

Hoje, no modo `platform`, `resolveTenantSender` devolve `process.env.EMAIL_FROM` inteiro. A clínica só consegue assinar os e-mails com o próprio nome depois de verificar domínio ou montar SMTP.

O **endereço** precisa ser de domínio verificado. O **nome de exibição, não** — `Clínica Alpha <remetente-da-plataforma>` é válido e não exige nenhuma configuração de DNS.

Mudança: no modo `platform`, usar `emailFromName` do tenant como nome, mantendo o endereço de `EMAIL_FROM`. Sem `emailFromName`, comportamento atual.

É a melhoria de melhor custo-benefício do onboarding: o paciente recebe e-mail assinado pela clínica desde o primeiro dia, sem a clínica fazer nada.

Sanitizar `emailFromName` removendo `<`, `>`, `"`, `\r` e `\n` — nome de remetente não sanitizado é vetor de injeção de header. O código atual já remove `<>`; ampliar para os demais.

---

## Guias de configuração

Componente `ConfigGuideDialog` compartilhado, no formato de `email-events-info-dialog.tsx`. Conteúdo em i18n, pt-BR e en. Aberto por link "Como configurar" ao lado de cada seção.

Estrutura de todo guia: **pré-requisitos → onde buscar cada valor → o que colar onde → como verificar → a armadilha**.

A armadilha é a parte que importa. É onde as clínicas travam, e nenhuma delas está documentada hoje.

### WhatsApp

| Passo | Onde | O quê |
|---|---|---|
| Pré-requisito | — | Conta Meta Business verificada e número **não registrado** no app WhatsApp comum |
| 1 | Meta for Developers → app → WhatsApp → Configuração da API | ID do número de telefone → *Phone Number ID* |
| 2 | mesma tela | ID da conta do WhatsApp Business → *WABA ID* |
| 3 | Meta Business → Configurações → Usuários do sistema | Gerar token permanente → *Access Token* |
| 4 | Meta → app → Webhooks | Colar a Callback URL que a tela exibe |
| 5 | Bucomax | Botão **Testar conexão**, que já existe |

**Armadilha:** a tela de Configuração da API exibe um token temporário de 24 horas, e é o que todo mundo copia. O token que funciona vem de Usuário do Sistema.

### E-mail — Gmail

Pré-requisito: verificação em duas etapas ativa. Gerar senha de app em `myaccount.google.com/apppasswords`. Host `smtp.gmail.com`, porta `587`, TLS. Usuário é o e-mail completo; senha é a senha de app.

**Armadilha:** a senha normal da conta não funciona desde 2022, e o erro do Google não diz isso.

### E-mail — Microsoft 365

Host `smtp.office365.com`, porta `587`, TLS.

**Armadilha:** SMTP AUTH vem desativado por padrão no tenant do Microsoft 365 e precisa ser habilitado pelo administrador. A falha vem com mensagem genérica de autenticação.

### E-mail — domínio próprio

Adicionar o domínio, copiar os registros SPF e DKIM que a tela devolve, colar no provedor de DNS, verificar.

**Armadilha:** propagação de DNS leva até 48h. "Não verificado" logo após colar é esperado — sem esse aviso a clínica reclica achando que errou.

---

## Bordas

| Situação | Comportamento |
|---|---|
| Clínica clona modelo e depois apaga o fluxo | Item volta a aparecer — o estado é derivado |
| Catálogo sem modelo publicado | Passo oferece "criar do zero", não trava |
| Modelo editado na plataforma depois da clonagem | Não afeta quem já clonou; clonagem é cópia, não vínculo |
| Clínica dispensa item e muda de ideia | Link "mostrar itens dispensados" reverte |
| Clínica sem CNPJ em mãos | Passo 0 fica pendente; o sistema continua utilizável |
| `slug` duplicado na criação | Já tratado: `SLUG_CONFLICT` |
| `emailFromName` com `<`, `>` ou quebra de linha | Sanitizado antes de compor o header |

---

## Testes

Com o Vitest configurado na Task 1 de `plans/2026-08-03-whatsapp-templates.md`. Use cases novos com injeção de dependência por parâmetro, default no singleton atual.

- clonagem gera etapas na ordem e com SLA corretos
- clonagem não referencia nenhum `FileAsset`
- clonagem cria versão publicada, não rascunho
- cada regra de conclusão dos seis passos, uma a uma
- item obrigatório não aceita dispensa
- `resolveTenantSender` no modo `platform` usa `emailFromName` quando existe e o `EMAIL_FROM` quando não
- `emailFromName` com caractere de injeção de header é sanitizado

---

## Fora de escopo

CRUD de `PathwayTemplate` com versionamento (a v1 tem CRUD simples de `super_admin`), cópia de documentos da plataforma para o tenant, normalização do endereço do tenant em campos separados, e relatório de quantas clínicas completaram cada passo.

---

## Arquivos afetados

| Área | Mudança |
|---|---|
| `packages/prisma/schema.prisma` | `PathwayTemplate`, `PathwayTemplateStage`, `Tenant.onboardingDismissed`, `Tenant.specialty` |
| `src/application/use-cases/pathway/clone-pathway-from-template.ts` | novo |
| `src/application/use-cases/tenant/get-onboarding-checklist.ts` | novo |
| `src/application/ports/pathway-template-repository.port.ts` | novo |
| `src/infrastructure/repositories/pathway-template.repository.ts` | novo |
| `src/infrastructure/email/resolve-tenant-sender.ts` | nome de exibição no modo `platform` |
| `src/app/api/v1/admin/pathway-templates/**` | CRUD de `super_admin` |
| `src/app/api/v1/tenant/onboarding/route.ts` | checklist e dispensa |
| `src/features/dashboard/app/components/onboarding-checklist-card.tsx` | novo |
| `src/features/settings/app/components/config-guide-dialog.tsx` | novo, compartilhado |
| `src/features/settings/app/components/create-tenant-wizard-dialog.tsx` | campo de especialidade |
| `messages/{pt-BR,en}/` | guias, checklist, especialidade |
| `public/openapi.json` | rotas novas |
| `docs/ARCHITECTURE.md` | §8 com os dois modelos novos |
| `.claude/rules/multi-tenant-journey.md` | `PathwayTemplate` deixa de ser ficção |
