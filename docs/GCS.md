# Google Cloud Storage (GCS) e deploy na Vercel

Este documento consolida o que o app espera (`src/infrastructure/storage/gcs-storage.ts`, `src/lib/constants/gcs.ts`) e o estado **consultado via `gcloud` / `gsutil`** no projeto GCP **submanager**.

## Projeto GCP

| Campo | Valor |
|--------|--------|
| **Project ID** | `submanager` |
| **App no código** | O cliente de Storage só opera se o projeto efetivo for `submanager` (`SUBMANAGER_GCS_PROJECT_ID`). |

## Buckets

| Bucket | Uso | Região (gsutil) |
|--------|-----|------------------|
| `submanager-dev-files` | Desenvolvimento | `southamerica-east1` |
| `submanager-prod-files` | Produção | `southamerica-east1` |

Listagem:

```bash
gsutil ls -p submanager
# gs://submanager/
# gs://submanager-dev-files/
# gs://submanager-prod-files/
```

### Bucket de produção (`submanager-prod-files`)

- **Location:** `SOUTHAMERICA-EAST1` (tipo region).
- **Uniform bucket-level access:** habilitado (`Bucket Policy Only`).
- **Lifecycle (resumo):** objetos em `STANDARD` passam para **`NEARLINE`** após **90 dias** (regra consultada com `gsutil lifecycle get gs://submanager-prod-files`).

## CORS (upload direto do browser)

O upload usa URL pré-assinada (v4); o browser faz **PUT** na URL do GCS. As origens permitidas ficam na configuração **CORS** do bucket.

### Produção (referência no repo)

Arquivo versionado: `scripts/gcs/cors-submanager-prod-files.json` (origens: `submanager.com.br`, wildcard `*.submanager.com.br`, `https://submanager-dashboard.vercel.app`).

Consulta atual: `gsutil cors get gs://submanager-prod-files`

**Vercel:** o host do app precisa estar em `origin` ou o **upload direto** (PUT na URL pré-assinada) falha por CORS no browser. Isso **não** corrige erro HTTP 500 em rotas API do Next (ex.: listagem de pacientes), que é outro fluxo.

Aplicar / atualizar:

```bash
gsutil cors set scripts/gcs/cors-submanager-prod-files.json gs://submanager-prod-files
```

### Desenvolvimento (referência)

`gsutil cors get gs://submanager-dev-files` inclui `http://localhost:3000` e `http://localhost:3001`.

## Variáveis de ambiente na Vercel

Defina no painel do projeto (**Settings → Environment Variables**), ambiente **Production** (e **Preview** se usar bucket de dev).

| Variável | Produção | Notas |
|----------|-----------|--------|
| `GCS_BUCKET_NAME` | `submanager-prod-files` | Nome exato do bucket. |
| `GCS_PROJECT_ID` | `submanager` | Alinhado ao projeto fixo no código. |
| `GCS_SERVICE_ACCOUNT_JSON` | *(segredo)* | JSON da service account em **uma linha**. Em serverless não use arquivo local; use esta variável. A conta precisa de permissão no bucket (ex.: **Storage Object Admin** no `submanager-prod-files`). |
| `GCS_PUBLIC_BASE_URL` | *(opcional)* | Só se houver base pública/CDN; muitos fluxos usam só presign. |

Referência também em `.env.example` na raiz do repositório.

### Service account

No `.env.example` há nota de SA dedicada, por exemplo `submanager-storage@submanager.iam.gserviceaccount.com`, com `objectAdmin` nos buckets. Confirme no **IAM** do GCP se a chave usada na Vercel corresponde a essa política no bucket de prod.

**Não** commite o JSON. Gere chave em **IAM → Service Accounts → chave JSON** e cole o conteúdo (minificado numa linha, se preferir) em `GCS_SERVICE_ACCOUNT_JSON` na Vercel.

## Comandos úteis (gcloud / gsutil)

```bash
gcloud config set project submanager

# Metadados do bucket de prod
gsutil ls -L -b gs://submanager-prod-files

# CORS atual
gsutil cors get gs://submanager-prod-files

# Lifecycle atual
gsutil lifecycle get gs://submanager-prod-files
```

## Checklist rápido antes de subir o app na Vercel

1. `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GCS_SERVICE_ACCOUNT_JSON` definidos na Vercel (Production).
2. Origem do front (domínio Vercel e/ou custom) presente no **CORS** do `submanager-prod-files`.
3. `NEXT_PUBLIC_APP_URL` (e demais URLs do app) apontando para o host público correto — ver `.env.example`.

---

*Valores de bucket, região, lifecycle e CORS foram obtidos com `gsutil` no projeto `submanager`. Atualize este arquivo se alterar buckets ou políticas no GCP.*
