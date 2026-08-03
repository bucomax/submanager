# Onboarding de novo tenant — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a clínica sair de painel vazio para sistema utilizável sem precisar desenhar um fluxo do zero nem adivinhar como configurar cada canal.

**Architecture:** Um catálogo `PathwayTemplate` curado pela plataforma é clonado pela clínica. Um checklist no topo do dashboard deriva cada item do estado real do banco — sem tabela de progresso que possa dessincronizar. Só a dispensa dos opcionais é persistida. Os guias de configuração reusam o formato de diálogo informativo que já existe.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 6 + PostgreSQL 16, Zod, Tailwind 4 + shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-03-onboarding-tenant-design.md`

**Pré-requisito:** a Task 1 de `plans/2026-08-03-whatsapp-templates.md` (Vitest). Se não rodou, executar antes.

**Ponto natural de corte:** as Tasks 1 a 5 entregam o catálogo e a clonagem, que já resolvem o painel vazio sozinhas. As Tasks 6 a 11 entregam o checklist e os guias. Dá para parar entre elas com software funcionando.

## Global Constraints

- Idioma: respostas ao usuário em pt-BR; código e símbolos exportados em inglês.
- Camadas: `domain` ← `application` ← `infrastructure` ← `app`/`features`. Nada de Prisma em `route.ts`.
- Envelope: `jsonSuccess(data)` / `jsonError(code, message, status)` de `src/lib/api-response.ts`.
- Guards: `requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership`. Rotas `/admin/*` com `superAdminOr403`. Configuração do tenant com `assertTenantAdminOrSuper`.
- `tenantId` sempre do JWT, nunca do body ou da query.
- Zod em `src/lib/validators/<domínio>.ts`. Proibido `interface`/`type` de contrato em `route.ts`, `page.tsx` ou componente.
- Tipos de API em `src/types/api/<domínio>-v1.ts`; sufixos `QueryParams` e `ResponseData`.
- `apiClient` já exibe `toast.error` em falha HTTP — não duplicar no catch.
- **Proibido `setState` dentro de `useEffect`** (`react-hooks/set-state-in-effect` é erro de lint). Estado derivado calcula no render; reset de formulário usa `key`.
- Arquivos em kebab-case; componentes em PascalCase; guia de 300 linhas por arquivo.
- Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`. Ao alterar modelo Prisma → conferir §8 de `docs/ARCHITECTURE.md`.
- Commits em Conventional Commits, direto na `main`, sem trailer `Co-Authored-By`.
- Gates: `npm run test` verde, `npx tsc --noEmit` limpo, `npm run lint` sem erro novo (baseline: 2 erros, 5 warnings).

---

### Task 1: Modelo do catálogo e campos do tenant

**Files:**
- Modify: `packages/prisma/schema.prisma`
- Create: migration gerada
- Modify: `docs/ARCHITECTURE.md` (§8)
- Modify: `.claude/rules/multi-tenant-journey.md`

**Interfaces:**
- Produces: `PathwayTemplate`, `PathwayTemplateStage`, `Tenant.onboardingDismissed`, `Tenant.specialty`

- [ ] **Step 1: Adicionar os modelos**

Copiar do spec, seção "Modelo de dados". Pontos que não podem mudar:

- `@@unique([templateId, stageKey])` — o `stageKey` identifica a etapa dentro do modelo e vira o `stageKey` do `PathwayStage` clonado
- `graphJson` no mesmo formato de `PathwayVersion.graphJson`, senão a clonagem precisa converter
- `onboardingDismissed String[] @default([])` em `Tenant`
- `specialty String?` em `Tenant`

- [ ] **Step 2: Gerar e aplicar**

```bash
npm run db:migrate -- --name pathway_templates_and_onboarding
```

Se o Postgres não estiver de pé: `docker compose up -d`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 4: Atualizar a documentação que estava errada**

Em `docs/ARCHITECTURE.md` §8, acrescentar os dois modelos.

Em `.claude/rules/multi-tenant-journey.md`, a linha que descreve `PathwayTemplate` existe desde antes e descrevia algo inexistente. Manter o texto e remover qualquer sugestão de que já estava implementado.

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/ docs/ARCHITECTURE.md .claude/rules/multi-tenant-journey.md
git commit -m "feat(prisma): catálogo de modelos de jornada e campos de onboarding

PathwayTemplate era citado nas rules e em três documentos sem existir no
schema. graphJson usa o mesmo formato de PathwayVersion para a clonagem ser
cópia direta, sem conversão."
```

---

### Task 2: Port e repositório do catálogo

**Files:**
- Create: `src/application/ports/pathway-template-repository.port.ts`
- Create: `src/infrastructure/repositories/pathway-template.repository.ts`
- Modify: `src/infrastructure/repositories/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TemplateChecklistItem = { label: string; requiredForTransition: boolean; sortOrder: number };
  export type PathwayTemplateStageRow = {
    stageKey: string; name: string; sortOrder: number;
    slaHours: number | null; patientMessage: string | null;
    checklistItems: TemplateChecklistItem[];
  };
  export type PathwayTemplateRow = {
    id: string; slug: string; name: string; description: string | null;
    specialty: string | null; isPublished: boolean; sortOrder: number;
  };
  export type PathwayTemplateWithStages = PathwayTemplateRow & {
    graphJson: unknown; stages: PathwayTemplateStageRow[];
  };
  export interface IPathwayTemplateRepository {
    listPublished(specialty?: string | null): Promise<PathwayTemplateRow[]>;
    listAll(): Promise<PathwayTemplateRow[]>;
    findWithStages(id: string): Promise<PathwayTemplateWithStages | null>;
    create(input: Omit<PathwayTemplateWithStages, "id">): Promise<PathwayTemplateRow>;
    update(id: string, input: Partial<Omit<PathwayTemplateWithStages, "id">>): Promise<PathwayTemplateRow>;
    remove(id: string): Promise<void>;
  }
  export const pathwayTemplatePrismaRepository: IPathwayTemplateRepository
  ```

- [ ] **Step 1: Schema Zod dos itens de checklist**

`checklistItems` é `Json` no banco. Criar em `src/lib/validators/pathway-template.ts`:

```ts
import { z } from "zod";

export const templateChecklistItemSchema = z.object({
  label: z.string().min(1).max(200),
  requiredForTransition: z.boolean().default(false),
  sortOrder: z.number().int().min(0),
});

export const templateChecklistItemsSchema = z.array(templateChecklistItemSchema).max(50);
export type TemplateChecklistItemInput = z.infer<typeof templateChecklistItemSchema>;
```

O repositório valida com `templateChecklistItemsSchema.safeParse` na leitura; item inválido no banco vira lista vazia em vez de derrubar a página.

- [ ] **Step 2: Port e repositório**

`listPublished` filtra `isPublished: true` e, quando `specialty` vem preenchido, aceita o valor **ou** `null` — modelo sem especialidade serve para todos.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/application/ports/pathway-template-repository.port.ts src/infrastructure/repositories/ src/lib/validators/pathway-template.ts
git commit -m "feat(pathways): port e repositório do catálogo de modelos

checklistItems inválido no banco vira lista vazia em vez de derrubar a
listagem — é Json, então o banco não garante o formato."
```

---

### Task 3: Use case de clonagem

O coração das primeiras cinco tasks.

**Files:**
- Create: `src/application/use-cases/pathway/clone-pathway-from-template.ts`
- Test: `src/application/use-cases/pathway/__tests__/clone-pathway-from-template.test.ts`

**Interfaces:**
- Consumes: `IPathwayTemplateRepository` (Task 2)
- Produces:
  ```ts
  export type ClonePathwayResult =
    | { ok: true; pathwayId: string; versionId: string; stageCount: number }
    | { ok: false; code: "TEMPLATE_NOT_FOUND" | "TEMPLATE_NOT_PUBLISHED" | "SLUG_CONFLICT" | "TEMPLATE_HAS_NO_STAGES" };

  export async function runClonePathwayFromTemplate(
    params: { tenantId: string; templateId: string; actorUserId: string; name?: string },
    deps?: ClonePathwayFromTemplateDeps,
  ): Promise<ClonePathwayResult>
  ```

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it, vi } from "vitest";
import { runClonePathwayFromTemplate } from "../clone-pathway-from-template";

const template = {
  id: "tpl1", slug: "terceiro-molar", name: "Cirurgia de 3º molar",
  description: null, specialty: "bucomaxilofacial", isPublished: true, sortOrder: 0,
  graphJson: { nodes: [], edges: [] },
  stages: [
    { stageKey: "consulta", name: "Consulta inicial", sortOrder: 0, slaHours: 48,
      patientMessage: "Bem-vindo", checklistItems: [{ label: "Anamnese", requiredForTransition: true, sortOrder: 0 }] },
    { stageKey: "exames", name: "Exames", sortOrder: 1, slaHours: 72,
      patientMessage: null, checklistItems: [] },
  ],
};

function makeDeps(over: Record<string, unknown> = {}) {
  return {
    templates: {
      listPublished: vi.fn(async () => []),
      listAll: vi.fn(async () => []),
      findWithStages: vi.fn(async () => template),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    persistClone: vi.fn(async () => ({ pathwayId: "cp1", versionId: "pv1", stageCount: 2 })),
    ...over,
  };
}

describe("runClonePathwayFromTemplate", () => {
  it("recusa modelo inexistente", async () => {
    const deps = makeDeps();
    deps.templates.findWithStages = vi.fn(async () => null);
    const result = await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "x", actorUserId: "u1" }, deps,
    );
    expect(result).toEqual({ ok: false, code: "TEMPLATE_NOT_FOUND" });
  });

  it("recusa modelo não publicado", async () => {
    const deps = makeDeps();
    deps.templates.findWithStages = vi.fn(async () => ({ ...template, isPublished: false }));
    const result = await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps,
    );
    expect(result).toEqual({ ok: false, code: "TEMPLATE_NOT_PUBLISHED" });
  });

  it("recusa modelo sem etapas em vez de criar fluxo vazio", async () => {
    const deps = makeDeps();
    deps.templates.findWithStages = vi.fn(async () => ({ ...template, stages: [] }));
    const result = await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps,
    );
    expect(result).toEqual({ ok: false, code: "TEMPLATE_HAS_NO_STAGES" });
  });

  it("clona etapas na ordem, com SLA e checklist", async () => {
    const deps = makeDeps();
    await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps,
    );

    const [payload] = deps.persistClone.mock.calls[0];
    expect(payload.stages).toHaveLength(2);
    expect(payload.stages[0]).toMatchObject({
      stageKey: "consulta", name: "Consulta inicial", sortOrder: 0, slaHours: 48,
    });
    expect(payload.stages[0].checklistItems[0]).toMatchObject({
      label: "Anamnese", requiredForTransition: true,
    });
    expect(payload.stages[1]).toMatchObject({ stageKey: "exames", sortOrder: 1 });
  });

  it("cria a versão já publicada", async () => {
    const deps = makeDeps();
    await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps,
    );
    const [payload] = deps.persistClone.mock.calls[0];
    expect(payload.publish).toBe(true);
  });

  it("não referencia nenhum FileAsset", async () => {
    const deps = makeDeps();
    await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps,
    );
    const [payload] = deps.persistClone.mock.calls[0];
    expect(JSON.stringify(payload)).not.toContain("fileAsset");
    expect(JSON.stringify(payload)).not.toContain("r2Key");
  });

  it("usa o nome informado quando vem, e o do modelo quando não vem", async () => {
    const deps = makeDeps();
    await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1", name: "Meu fluxo" }, deps,
    );
    expect(deps.persistClone.mock.calls[0][0].name).toBe("Meu fluxo");

    const deps2 = makeDeps();
    await runClonePathwayFromTemplate(
      { tenantId: "t1", templateId: "tpl1", actorUserId: "u1" }, deps2,
    );
    expect(deps2.persistClone.mock.calls[0][0].name).toBe("Cirurgia de 3º molar");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- clone-pathway-from-template`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

O use case monta o payload e delega a persistência a `persistClone`, que roda numa transação Prisma criando `CarePathway` → `PathwayVersion` (publicada) → `PathwayStage[]` → `PathwayStageChecklistItem[]`.

Separar assim é o que torna a regra testável sem banco: o teste verifica o payload, e a transação é exercitada no E2E.

Slug do `CarePathway` derivado do nome, com sufixo numérico em caso de conflito no tenant.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- clone-pathway-from-template`
Expected: 7 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/pathway/
git commit -m "feat(pathways): clona fluxo a partir de modelo da plataforma

A versão nasce publicada: o modelo é curado, e deixar em rascunho obrigaria
a clínica a descobrir sozinha o passo de publicar — que é o que o onboarding
existe para evitar.

Modelo sem etapas é recusado em vez de gerar fluxo vazio, que passaria no
checklist sem servir para nada."
```

---

### Task 4: CRUD de modelos para super_admin

**Files:**
- Create: `src/app/api/v1/admin/pathway-templates/route.ts`
- Create: `src/app/api/v1/admin/pathway-templates/[templateId]/route.ts`
- Create: `src/types/api/pathway-templates-v1.ts`
- Modify: `src/lib/validators/pathway-template.ts`
- Modify: `public/openapi.json`, `messages/{pt-BR,en}/api.json`

- [ ] **Step 1: Schemas e tipos**

`createPathwayTemplateBodySchema` e `patchPathwayTemplateBodySchema`. Etapas com `stageKey` único dentro do modelo — validar por `refine`, não deixar o erro chegar como violação de constraint.

- [ ] **Step 2: Rotas**

`GET` lista tudo, `POST` cria, `PATCH` edita, `DELETE` remove. Todas com `requireSessionOr401` + `superAdminOr403`.

- [ ] **Step 3: OpenAPI e i18n**

- [ ] **Step 4: Verificar e commitar**

Run: `npx tsc --noEmit && npm run lint`

---

### Task 5: Rota de clonagem pelo tenant

**Files:**
- Create: `src/app/api/v1/pathway-templates/route.ts` (catálogo publicado)
- Create: `src/app/api/v1/pathway-templates/[templateId]/clone/route.ts`
- Modify: `public/openapi.json`, `messages/{pt-BR,en}/api.json`

- [ ] **Step 1: Catálogo**

`GET /api/v1/pathway-templates` devolve os publicados, filtrados por `Tenant.specialty`. Guards de tenant, sem exigir admin — qualquer membro pode ver o catálogo.

- [ ] **Step 2: Clonagem**

`POST /api/v1/pathway-templates/{id}/clone` com `assertTenantAdminOrSuper` — criar fluxo é ação de administrador.

Mapeamento de erro: `TEMPLATE_NOT_FOUND` → 404, `TEMPLATE_NOT_PUBLISHED` → 404 (não revelar que existe modelo despublicado), `TEMPLATE_HAS_NO_STAGES` → 422, `SLUG_CONFLICT` → 409.

- [ ] **Step 3: Verificar e commitar**

**Neste ponto o painel vazio já está resolvido.** Dá para parar aqui com software funcionando.

---

### Task 6: Nome do remetente no modo plataforma

Independente do resto — pode ser feita antes se quiser valor rápido.

**Files:**
- Modify: `src/infrastructure/email/resolve-tenant-sender.ts`
- Create: `src/lib/utils/email-header.ts`
- Test: `src/infrastructure/email/__tests__/resolve-tenant-sender.test.ts`
- Test: `src/lib/utils/__tests__/email-header.test.ts`

**Interfaces:**
- Produces: `export function sanitizeDisplayName(raw: string): string`

- [ ] **Step 1: Teste da sanitização**

```ts
import { describe, expect, it } from "vitest";
import { sanitizeDisplayName } from "@/lib/utils/email-header";

describe("sanitizeDisplayName", () => {
  it("remove os delimitadores de endereço", () => {
    expect(sanitizeDisplayName("Clínica <hack@evil.com>")).toBe("Clínica hack@evil.com");
  });

  it("remove quebra de linha, que é o vetor de injeção de header", () => {
    expect(sanitizeDisplayName("Clínica\r\nBcc: vitima@x.com")).toBe("ClínicaBcc: vitima@x.com");
  });

  it("remove aspas duplas", () => {
    expect(sanitizeDisplayName('Clínica "Alpha"')).toBe("Clínica Alpha");
  });

  it("preserva acento e espaço", () => {
    expect(sanitizeDisplayName("Clínica São José")).toBe("Clínica São José");
  });

  it("corta em 100 caracteres", () => {
    expect(sanitizeDisplayName("a".repeat(200))).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Rodar, implementar, rodar**

Run: `npm run test -- email-header`

- [ ] **Step 3: Teste do resolvedor**

Casos: modo `platform` com `emailFromName` → `"Clínica Alpha <endereço-do-EMAIL_FROM>"`; modo `platform` sem `emailFromName` → `EMAIL_FROM` inteiro, comportamento atual; `emailFromName` com caractere de injeção → sanitizado; modos `smtp` e `resend_domain` inalterados.

Extrair o endereço de `EMAIL_FROM` exige tratar os dois formatos possíveis: `"Nome <a@b.com>"` e `"a@b.com"` puro.

- [ ] **Step 4: Implementar**

No caminho de fallback do `resolveTenantSender`, quando o tenant tem `emailFromName`, compor com o endereço extraído de `EMAIL_FROM`. Aplicar `sanitizeDisplayName` nos três caminhos, substituindo o `.replace(/[<>]/g, "")` atual.

- [ ] **Step 5: Rodar e commitar**

```bash
git add src/lib/utils/email-header.ts src/infrastructure/email/
git commit -m "feat(email): clínica assina os e-mails com o próprio nome no modo padrão

O endereço precisa ser de domínio verificado; o nome de exibição não. Antes,
o modo platform devolvia EMAIL_FROM inteiro e a clínica só assinava os
próprios e-mails depois de verificar domínio ou montar SMTP.

A sanitização passa a remover aspas e quebra de linha além de <>: nome de
remetente não sanitizado é vetor de injeção de header."
```

---

### Task 7: Use case do checklist

**Files:**
- Create: `src/application/use-cases/tenant/get-onboarding-checklist.ts`
- Test: `src/application/use-cases/tenant/__tests__/get-onboarding-checklist.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OnboardingItemKey = "company" | "pathway" | "email" | "whatsapp" | "team" | "opme";
  export type OnboardingItemWeight = "required" | "recommended" | "optional";
  export type OnboardingItem = {
    key: OnboardingItemKey; weight: OnboardingItemWeight;
    done: boolean; dismissed: boolean;
  };
  export type OnboardingChecklist = { items: OnboardingItem[]; allRequiredDone: boolean; visible: boolean };
  export async function runGetOnboardingChecklist(
    params: { tenantId: string }, deps?: GetOnboardingChecklistDeps,
  ): Promise<OnboardingChecklist>
  ```

- [ ] **Step 1: Testes de cada regra**

Um teste por item, mais os de agregação:

- `company` fica `done` só com `taxId` **e** `phone`; só um dos dois não basta
- `pathway` fica `done` com `CarePathway` que tenha versão publicada; fluxo só em rascunho não conta
- `email` fica `done` com `emailFromName` preenchido, em qualquer modo
- `whatsapp` fica `done` com `whatsappVerifiedAt` preenchido; `whatsappEnabled` sozinho não basta
- `team` fica `done` com mais de uma membership
- `opme` fica `done` com pelo menos um `OpmeSupplier`
- `company` e `pathway` ignoram `onboardingDismissed` mesmo se a chave estiver lá
- `visible` é falso quando os obrigatórios estão feitos e os demais estão feitos ou dispensados
- `visible` é verdadeiro com qualquer obrigatório pendente

- [ ] **Step 2: Rodar, implementar, rodar**

Run: `npm run test -- get-onboarding-checklist`

Uma consulta agregada, não seis. Contadores por `_count` onde der.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/tenant/
git commit -m "feat(onboarding): checklist derivado do estado real

Nenhuma tabela de progresso: cada item é uma pergunta ao banco, então
desfazer uma configuração faz o item voltar sozinho. Itens obrigatórios
ignoram a lista de dispensa."
```

---

### Task 8: Rota do checklist e dispensa

**Files:**
- Create: `src/app/api/v1/tenant/onboarding/route.ts`
- Create: `src/app/api/v1/tenant/onboarding/dismiss/route.ts`
- Create: `src/types/api/onboarding-v1.ts`
- Modify: `src/lib/validators/tenant.ts`, `public/openapi.json`, `messages/{pt-BR,en}/api.json`

- [ ] **Step 1: Rotas**

`GET` devolve o checklist. `POST /dismiss` recebe `{ key, dismissed }` e atualiza `onboardingDismissed`.

Dispensar item obrigatório responde **422** com mensagem explícita — não ignorar em silêncio, senão o frontend acha que funcionou.

- [ ] **Step 2: OpenAPI, i18n, verificar e commitar**

---

### Task 9: Card do checklist no dashboard

**Files:**
- Create: `src/features/dashboard/app/components/onboarding-checklist-card.tsx`
- Create: `src/features/dashboard/app/services/onboarding.service.ts`
- Create: `src/features/dashboard/app/hooks/use-onboarding-checklist.ts`
- Modify: `src/features/dashboard/app/pages/dashboard-page.tsx`
- Modify: `messages/{pt-BR,en}/dashboard.json`

- [ ] **Step 1: Service e hook**

Só HTTP via `apiClient`. **Sem `setState` em `useEffect`** — o estado do checklist vem da resposta e é derivado no render.

- [ ] **Step 2: Card**

Lista os seis itens com estado, peso e ação. Item concluído aparece riscado. Opcional tem "dispensar"; dispensado só aparece atrás de "mostrar itens dispensados".

Cada item leva à tela correspondente: passo 0 para configurações da clínica, passo 1 abre o seletor de modelo, e assim por diante.

- [ ] **Step 3: Posição no dashboard**

No topo, só quando `visible`. Enquanto não há fluxo publicado, ocupa o lugar dos cards de métrica — que hoje mostram zeros sem explicação.

- [ ] **Step 4: Verificar e commitar**

Run: `npx tsc --noEmit && npm run lint` — lint sem erro novo é obrigatório.

---

### Task 10: Seletor de modelo e guias de configuração

**Files:**
- Create: `src/features/pathways/app/components/pathway-template-picker-dialog.tsx`
- Create: `src/features/settings/app/components/config-guide-dialog.tsx`
- Modify: `src/features/settings/app/components/whatsapp-settings-card.tsx`
- Modify: `src/features/settings/app/components/email-settings-card.tsx`
- Modify: `src/features/settings/app/components/tenant-smtp-settings-block.tsx`
- Modify: `messages/{pt-BR,en}/{pathways,settings}.json`

- [ ] **Step 1: Seletor de modelo**

`StandardDialogContent` com os modelos publicados em cards: nome, descrição, quantidade de etapas. Mais a opção "começar do zero", que leva ao editor.

Catálogo vazio mostra só "começar do zero" — não travar.

- [ ] **Step 2: `ConfigGuideDialog` compartilhado**

Formato de `email-events-info-dialog.tsx`. Recebe uma chave de guia e renderiza a estrutura: pré-requisitos, passos numerados, como verificar, e um bloco de destaque para a armadilha.

Conteúdo em i18n. Todo o texto está na seção "Guias de configuração" do spec — copiar de lá, incluindo as armadilhas, que são a parte que importa:

- WhatsApp: o token da tela de Configuração da API expira em 24h; o que funciona vem de Usuário do Sistema
- Gmail: senha da conta não funciona desde 2022, precisa de senha de app
- Microsoft 365: SMTP AUTH vem desativado por padrão no tenant
- Domínio: propagação de DNS leva até 48h, "não verificado" logo após colar é esperado

- [ ] **Step 3: Ligar os links "Como configurar"**

Nos três cards de configuração. **Atenção:** `whatsapp-settings-card.tsx` e `tenant-smtp-settings-block.tsx` usam `serverForm` memoizado + `useSyncedDraft`. Não reintroduzir `setState` em `useEffect`.

- [ ] **Step 4: Verificar e commitar**

---

### Task 11: Especialidade no wizard e fechamento

**Files:**
- Modify: `src/features/settings/app/components/create-tenant-wizard-dialog.tsx`
- Modify: `src/features/settings/app/utils/schemas.ts`
- Modify: `src/lib/validators/tenant.ts`
- Modify: `src/application/use-cases/admin/create-tenant.ts`
- Modify: `src/infrastructure/repositories/tenant.repository.ts`
- Modify: `src/application/ports/tenant-repository.port.ts`
- Create: `e2e/onboarding-checklist.spec.ts`

- [ ] **Step 1: Campo de especialidade**

Select na etapa 1 do wizard, opcional. Valores como constante em `src/lib/constants/`, não string solta.

Propagar por `CreateTenantParams` → `createTenant`.

- [ ] **Step 2: `affiliatedHospitals` nas configurações da clínica**

O campo existe no modelo e não está em nenhuma tela. Adicionar em `clinic-settings-card.tsx` como textarea opcional.

- [ ] **Step 3: E2E**

Seguindo `e2e/patient-self-register.spec.ts`: semear um `PathwayTemplate` publicado, criar tenant, logar como o admin, conferir o card com `company` e `pathway` pendentes, clonar um modelo, e confirmar que `pathway` fica concluído e o fluxo aparece em `/dashboard/pathways`.

- [ ] **Step 4: Rodar a suíte inteira**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add src/ e2e/ messages/
git commit -m "feat(onboarding): especialidade da clínica e hospitais conveniados

A especialidade filtra o catálogo de modelos no checklist.
affiliatedHospitals existia no schema sem nenhuma tela — para bucomaxilo,
onde a cirurgia acontece em hospital conveniado, é informação de operação."
```

---

## Self-Review

**Cobertura do spec:**

| Requisito | Task |
|---|---|
| `PathwayTemplate` + `PathwayTemplateStage` | 1 |
| `Tenant.onboardingDismissed` e `Tenant.specialty` | 1 |
| Clonagem sem `FileAsset` | 3 |
| Clonagem gera versão publicada | 3 |
| CRUD de modelos para `super_admin` | 4 |
| Catálogo filtrado por especialidade | 2, 5 |
| Catálogo vazio não trava | 10 |
| Nome do remetente no modo `platform` | 6 |
| Sanitização do nome de remetente | 6 |
| Seis itens do checklist, derivados do estado | 7 |
| `company` exige CNPJ e telefone | 7 |
| Obrigatório não aceita dispensa | 7, 8 |
| Card no dashboard, some quando concluído | 9 |
| Guias com as quatro armadilhas | 10 |
| Especialidade no wizard | 11 |
| `affiliatedHospitals` com tela | 11 |
| E2E do ciclo | 11 |

Sem lacunas.

**Consistência de tipos:** `PathwayTemplateWithStages` (Task 2) é o que `runClonePathwayFromTemplate` (Task 3) consome via `findWithStages`, e `TemplateChecklistItem` tem os mesmos três campos do `templateChecklistItemSchema` (Task 2) e do que a Task 3 verifica no payload. `OnboardingItemKey` (Task 7) é o mesmo conjunto de chaves aceito pelo `POST /dismiss` (Task 8) e renderizado no card (Task 9).

**Ponto de atenção:** a Task 6 é independente das outras dez. Se quiser valor imediato antes de qualquer coisa, é ela — um campo e uma função de sanitização fazem toda clínica passar a assinar os próprios e-mails.
