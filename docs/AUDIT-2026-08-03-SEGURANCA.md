# Auditoria de Segurança — SubManager

**Data:** 2026-08-03
**Escopo:** `src/**`, `packages/prisma/schema.prisma`, `next.config.ts`, `src/proxy.ts`, dependências de produção
**Método:** leitura de código (91 route handlers, guards, crypto, storage, webhooks), `npx tsc --noEmit`, `npm run lint`, `npm audit --production`

---

## Veredito

Base de autorização é sólida: guards compostos, `tenantId` sempre derivado do JWT, sessão de portal separada da sessão de staff, cookie HMAC com invalidação por versão de senha, validação de magic bytes pós-upload, chaves GCS com prefixo por tenant. O que falha não é o desenho — é a **borda**: autenticação sem throttle, webhook que aceita payload não assinado, e componentes de segurança que degradam em silêncio quando o Redis some.

Nenhum bypass de tenant encontrado. Nenhum `any`. Zero erro de tipo.

---

## Matriz de achados

| # | Severidade | Área | Arquivo |
|---|-----------|------|---------|
| 1 | **Crítico** | Brute force no login de staff | `src/app/api/auth/[...nextauth]/route.ts` |
| 2 | **Alto** | Webhook WhatsApp aceita payload não assinado | `src/app/api/v1/webhooks/whatsapp/route.ts:44` |
| 3 | **Alto** | Rate limit e lock distribuído fail-open sem Redis | `src/lib/api/rate-limit.ts:47`, `src/lib/api/distributed-lock.ts:11` |
| 4 | **Alto** | Tokens bearer em texto plano no banco | `packages/prisma/schema.prisma:132,328,365` |
| 5 | **Médio** | CSP com `unsafe-inline` + `unsafe-eval`; sem HSTS | `next.config.ts:10` |
| 6 | **Médio** | Segredo AES do cliente exposto no bundle | `.env.example` (`NEXT_PUBLIC_APP_PERSIST_SECRET`) |
| 7 | **Médio** | `jose` usado sem constar no `package.json` | `src/lib/auth/app-scoped-token.ts:1` |
| 8 | **Médio** | `NEXTAUTH_SECRET` reutilizado em 4 domínios criptográficos | `app-scoped-token.ts`, `patient-portal-session.ts`, `patient-portal-otp.ts` |
| 9 | **Médio** | Presign PUT sem allowlist de MIME; limite de 500 MB | `src/lib/validators/file.ts:12` |
| 10 | **Médio** | 30 vulnerabilidades em deps de produção (1 crítica, 11 altas) | `npm audit` |
| 11 | **Baixo** | Enumeração de usuário por timing no login | `src/lib/auth/auth-options.ts:24` |
| 12 | **Baixo** | Preset `sse` de rate limit definido e nunca usado | `src/lib/api/rate-limit.ts:14` |
| 13 | **Baixo** | Comparação de hash de OTP não timing-safe | `verify-patient-portal-otp.ts:38` |
| 14 | **Baixo** | IV de 16 bytes em AES-GCM (padrão NIST: 12) | `src/infrastructure/crypto/tenant-secret.ts:4` |
| 15 | **Baixo** | `/files/storage-status` exige só sessão | `src/app/api/v1/files/storage-status/route.ts` |

---

## Achados detalhados

### 1. Login de staff sem rate limit — Crítico

`requireSessionOr401()` aplica `rateLimit("api", session.user.id)` **depois** de a sessão existir. A rota de credenciais do NextAuth não passa por guard nenhum:

```ts
// src/app/api/auth/[...nextauth]/route.ts — íntegro
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

E o middleware não cobre `/api`:

```ts
// src/proxy.ts:69
matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
```

`POST /api/auth/callback/credentials` fica sem throttle, sem lockout de conta, sem CAPTCHA. Política de senha do staff é `min(8)` sem exigência de composição (`src/lib/validators/profile.ts:35`). O portal do paciente tem throttle (`patientPortalPassword`: 5/15min) — o painel administrativo não tem.

**Impacto:** password spraying contra contas de clínica. Um `tenant_admin` comprometido lê todo o prontuário do tenant.

**Correção:** interceptar `authorize()` com `rateLimit("auth", ip)` + contador por e-mail, ou envolver o handler:

```ts
export async function POST(req: NextRequest, ctx: unknown) {
  if (req.nextUrl.pathname.endsWith("/callback/credentials")) {
    const limited = await rateLimit("auth");   // por IP
    if (limited) return limited;
  }
  return handler(req, ctx);
}
```

Somar lockout progressivo por e-mail — os eventos já existem em `recordStaffLoginFailed`.

---

### 2. Webhook WhatsApp aceita payload não assinado — Alto

```ts
// src/app/api/v1/webhooks/whatsapp/route.ts:44
if (appSecret && signature) {
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (signature !== expected) return new Response("Invalid signature", { status: 401 });
}
// segue processando mesmo sem assinatura
```

Duas falhas:

1. **Fail-open.** Sem `WHATSAPP_APP_SECRET` no ambiente, ou sem o header `x-hub-signature-256` na requisição, o payload é processado como legítimo. Qualquer um que descubra a URL injeta status de entrega e respostas de botão interativo em nome de pacientes.
2. **Comparação não timing-safe** (`signature !== expected`). O webhook de apps, no mesmo repo, faz certo com `timingSafeEqual` (`webhooks/apps/[appSlug]/route.ts:41`) — o de WhatsApp ficou para trás.

O de Resend está correto (Svix, rejeita 503 sem secret, 400 sem headers).

**Correção:** exigir secret e assinatura sempre; `timingSafeEqual` na comparação.

---

### 3. Rate limit e lock fail-open sem Redis — Alto

```ts
// src/lib/api/rate-limit.ts:47
const redis = getRedisConnection();
if (!redis) return null;            // sem Redis → sem limite
// ...
} catch { return null; }            // erro do Redis → sem limite
```

```ts
// src/lib/api/distributed-lock.ts:11
if (!redis) return true;            // sem Redis → todo mundo ganha o lock
```

O `.env.example` documenta `REDIS_URL=` vazio como configuração válida ("evita ECONNREFUSED"). Nessa configuração o app roda **sem nenhum rate limiting** (todos os presets) e **sem lock na transição de etapa** — duas requisições concorrentes de `POST /patient-pathways/:id/transition` gravam dois `StageTransition` para a mesma etapa.

Um `finally { await releaseLock() }` também libera o lock quando a transação estoura o TTL de 10 s, o que reabre a janela em operações lentas.

**Correção:** exigir Redis em `NODE_ENV=production` (falhar no boot, não em runtime). Para o lock, alternativa sem Redis: `SELECT ... FOR UPDATE` na `PatientPathway` dentro da transação Prisma — garante exclusão mútua real e não depende de infra externa.

---

### 4. Tokens bearer em texto plano no banco — Alto

Três modelos guardam segredo de autenticação sem hash:

| Modelo | Campo | Uso |
|--------|-------|-----|
| `UserAuthToken` | `token` | reset de senha, convite de membro |
| `PatientPortalLinkToken` | `token` | magic link do portal do paciente |
| `PatientSelfRegisterInvite` | `token` | QR de auto-cadastro |

Contraste: o OTP do portal **é** hasheado (`codeHash`, HMAC-SHA256 em `src/lib/utils/patient-portal-otp.ts:17`). A regra existe no projeto, só não foi aplicada nos demais.

Entropia dos tokens está correta — `randomBytes(32)`, 256 bits. O problema é o repouso: qualquer leitura do banco (backup, réplica, log de query, SQL injection futuro, acesso de terceiro ao Supabase) entrega tomada de conta de staff e sessão de portal de qualquer paciente.

**Correção:** guardar `sha256(token)` e comparar por hash na busca. Migração compatível: adicionar `tokenHash`, popular, buscar pelos dois durante a transição, depois derrubar `token`.

---

### 5. CSP permissiva e sem HSTS — Médio

```ts
// next.config.ts:10
"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
"style-src 'self' 'unsafe-inline'",
```

`unsafe-inline` em `script-src` neutraliza a CSP como defesa contra XSS. Como o app renderiza dados clínicos e nome de paciente vindos de auto-cadastro público (`/patient-self-register`), o vetor é real.

Ausentes: `Strict-Transport-Security`, `Permissions-Policy`, `X-Frame-Options` (há `frame-ancestors 'self'`, o que cobre navegadores modernos).

`img-src` aceita `http:` — mixed content.

**Correção:** nonce por request na CSP (Next.js suporta via middleware), remover `unsafe-eval`, adicionar HSTS com `max-age=31536000; includeSubDomains`.

---

### 6. Segredo AES do cliente no bundle — Médio

```
# .env.example
NEXT_PUBLIC_APP_PERSIST_SECRET="troque-com-string-longa-32-chars-minimo!!"
# Cliente: AES para estado persistido no localStorage (mín. 32 caracteres; público no bundle)
```

Chave `NEXT_PUBLIC_*` é servida no JavaScript. A criptografia do estado em `localStorage` protege contra ninguém: quem lê o `localStorage` também lê a chave. O comentário reconhece isso, o que é honesto, mas o padrão convida a guardar dado sensível ali achando que está protegido.

**Correção:** decidir explicitamente — ou nada sensível vai para `localStorage` (e a cifra sai), ou o dado sensível fica só no servidor.

---

### 7. `jose` como dependência fantasma — Médio

`src/lib/auth/app-scoped-token.ts:1` importa `jose`, que não está em `dependencies` nem `devDependencies`. Resolve hoje via árvore transitiva do `next-auth`. Um bump do `next-auth` que troque de biblioteca JWT quebra o build de produção sem aviso.

**Correção:** `npm i jose`.

---

### 8. Segredo único para quatro propósitos — Médio

`NEXTAUTH_SECRET` assina: JWT de sessão do NextAuth, app-scoped token (`app-scoped-token.ts:11`), cookie de sessão do portal (`patient-portal-session.ts:34`, fallback) e HMAC do OTP (`patient-portal-otp.ts:5`, fallback).

Não há vazamento conhecido entre os domínios — os payloads têm formato distinto e `jwtVerify` valida `issuer`/`audience`. Mas rotacionar o segredo derruba tudo de uma vez, e uma futura confusão de formato vira cross-domain forgery.

**Correção:** derivar chaves por propósito com HKDF a partir de um segredo mestre, ou variáveis separadas (`PATIENT_PORTAL_SECRET` já existe — torná-la obrigatória).

---

### 9. Presign de upload sem allowlist — Médio

```ts
// src/lib/validators/file.ts
mimeType: z.string().min(1).max(200),            // qualquer string
sizeBytes: z.number().int().positive().max(500 * 1024 * 1024),   // 500 MB
```

O presign v4 é emitido para qualquer `contentType` com TTL de 1 hora. A validação de magic bytes acontece só no `register`, **depois** do objeto já estar no bucket (`register-staff-file-after-upload.ts:51`) — desenho correto para o fluxo, mas objetos que nunca chegam ao register ficam órfãos no bucket sem validação nem cobrança de lifecycle.

500 MB por arquivo, com URL de escrita válida por 1 h, é vetor de custo.

**Correção:** enum de MIME permitido no presign, teto de tamanho por tipo (PDF/imagem clínica não precisa de 500 MB), TTL de presign de 15 min, lifecycle no bucket para objetos sem `FileAsset` correspondente.

---

### 10. Dependências vulneráveis — Médio

`npm audit --production`: **30 vulnerabilidades — 1 crítica, 11 altas, 14 moderadas, 4 baixas.**

Pacotes de superfície direta com advisories altos: `next`, `next-auth` (crítica), `axios`, `nodemailer`, `postcss`, `js-yaml`, `form-data`, `sharp`, `hono`, `svix`/`gaxios` (via `uuid`).

**Correção:** `npm audit fix`, avaliar `--force` para os que exigem major, e adicionar `npm audit --production --audit-level=high` ao CI.

---

### 11–15. Achados menores

**11. Enumeração por timing.** `auth-options.ts:24` só chama `bcrypt.compare` quando o usuário existe. A diferença de latência (~100 ms) revela e-mails cadastrados. Corrigir com hash dummy no caminho negativo.

**12. Preset `sse` órfão.** `PRESETS.sse` (3/10s) está definido mas nenhuma rota o usa. `/notifications/stream` fica com o preset `api` (120/min) — cada conexão SSE segura um handler. Aplicar o preset.

**13. Hash de OTP com `!==`.** `verify-patient-portal-otp.ts:38` compara hashes hex com `!==`. Ataque de timing sobre hash é impraticável, mas o cookie do portal já usa `timingSafeEqual` — vale uniformizar.

**14. IV de 16 bytes em GCM.** `tenant-secret.ts:4` usa `IV_LENGTH = 16`. GCM especifica 96 bits (12 bytes); IVs maiores passam por GHASH extra. Funciona, mas é não-padrão. Mudar exige migração dos ciphertexts existentes — baixa prioridade.

**15. `storage-status`.** Só `requireSessionOr401`, sem tenant. Revela se o GCS está configurado. Ruído de reconhecimento, não vazamento.

---

## O que está correto

Não é lista de cortesia — são controles que passaram na leitura:

- **Isolamento multi-tenant.** `tenantId` sempre de `session.user.tenantId` (que vem do `TenantMembership`, não do body). Nenhuma rota aceita `tenantId` do cliente. `getActiveTenantIdOr400` valida `isActive` do tenant a cada request.
- **Guards compostos.** Cadeia linear `requireSessionOr401 → getActiveTenantIdOr400 → assertActiveTenantMembership`, aplicada consistentemente nos 91 handlers. Rotas `/admin/*` com `superAdminOr403`.
- **Visibilidade granular.** `restrictedToAssignedOnly` e `linkedOpmeSupplierId` filtram no `where` do Prisma via `mergeClientWhereWithVisibility`, inclusive dentro do `unstable_cache` (a chave de cache inclui `viewerUserId` e `scope` — não há vazamento cruzado no cache).
- **Sessão do portal do paciente.** Cookie separado, `httpOnly`, `secure` em produção, HMAC-SHA256 com `timingSafeEqual`, `exp` verificado, e `pwdv` que invalida a sessão quando a senha do portal muda. Header `x-patient-portal-tenant-slug` conferido contra o slug do cookie **e** contra o tenant no banco.
- **Magic link.** Verifica expiração, `deletedAt` do cliente, uso único, e amarração `client.tenantId === tenant.id`. Sem confusão de tenant.
- **OTP.** 6 dígitos via `randomInt` (CSPRNG), hash HMAC no banco, TTL de 15 min, 5 tentativas por desafio, 5 desafios por hora por paciente, resposta opaca quando o paciente não existe (anti-enumeração).
- **Upload.** Magic bytes validados contra o objeto no bucket após o upload; `keyMatchesFileRegisterIntent` impede registrar chave de outro tenant ou de outro paciente; SHA-256 calculado do objeto real.
- **Segredos de tenant.** AES-256-GCM autenticado para SMTP e config de apps; mascarados na resposta da API.
- **Auditoria.** `AuditEvent` em transição, upload, sessão de portal, login de staff — sem payload clínico.

---

## LGPD

| Item | Estado |
|------|--------|
| Logs sem CPF/telefone/conteúdo clínico | OK — 62 `console.*`, nenhum com PII (só IDs e mensagens de erro) |
| `AuditEvent` sem payload clínico | OK |
| Objetos GCS com prefixo por tenant | OK — `tenants/{tenantId}/clients/{clientId}/...` |
| URLs assinadas com TTL curto | Parcial — download 300 s (OK), upload 3600 s (longo) |
| Soft delete de paciente | OK — `deletedAt` respeitado em todas as leituras verificadas |
| Tokens de acesso em repouso | **Falha** — achado #4 |
| Retenção/expurgo de dados | Não implementado — sem job de purga por tenant |
| Exportação de dados do titular | Existe — `/clients/:id/audit-export` (restrito a `tenant_admin`) |

---

## Ordem de correção sugerida

1. Rate limit no login de staff (#1) — mudança de ~20 linhas, fecha o vetor mais explorável.
2. Webhook WhatsApp fail-closed + `timingSafeEqual` (#2) — ~10 linhas.
3. `npm i jose` (#7) — 1 comando, evita quebra silenciosa de build.
4. Redis obrigatório em produção (#3) — validação no boot.
5. Hash dos tokens no banco (#4) — exige migração.
6. CSP com nonce + HSTS (#5).
7. `npm audit fix` + gate no CI (#10).
