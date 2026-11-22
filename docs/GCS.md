# Google Cloud Storage (GCS)

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

Arquivo versionado: `scripts/gcs/cors-submanager-prod-files.json` (origens: domínios `bucomax.com.br` e `*.bucomax.com.br`, mais a URL do Cloud Run `https://submanager-714014611104.us-east4.run.app`).

Consulta atual: `gsutil cors get gs://submanager-prod-files`

**Cloud Run:** o host do app precisa estar em `origin` ou o **upload direto** (PUT na URL pré-assinada) falha por CORS no browser. Isso **não** corrige erro HTTP 500 em rotas API do Next (ex.: listagem de pacientes), que é outro fluxo.

Aplicar / atualizar:

```bash
gsutil cors set scripts/gcs/cors-submanager-prod-files.json gs://submanager-prod-files
```

### Desenvolvimento (referência)

`gsutil cors get gs://submanager-dev-files` inclui `http://localhost:3000` e `http://localhost:3001`.

## Variáveis de ambiente (Cloud Run)

Defina como variáveis do serviço Cloud Run; valores sensíveis no **Secret Manager**, referenciados no serviço.

| Variável | Produção | Notas |
|----------|-----------|--------|
| `GCS_BUCKET_NAME` | `submanager-prod-files` | Nome exato do bucket. |
| `GCS_PROJECT_ID` | `submanager` | Alinhado ao projeto fixo no código. |
| `GCS_SERVICE_ACCOUNT_JSON` | *(opcional)* | Só se não usar ADC. JSON da service account em **uma linha**, guardado no Secret Manager. |
| `GCS_PUBLIC_BASE_URL` | *(opcional)* | Só se houver base pública/CDN; muitos fluxos usam só presign. |

Referência também em `.env.example` na raiz do repositório.

### Credenciais (ADC, padrão)

No Cloud Run o padrão é **Application Default Credentials** com a **service account de runtime** do serviço, sem chave JSON. Ela precisa de:

- `roles/storage.objectAdmin` nos buckets (leitura, escrita e remoção de objetos);
- `roles/iam.serviceAccountTokenCreator` em si mesma, necessário para assinar URLs v4 (presign) via IAM `signBlob` sem chave privada.

**Não** commite chaves JSON. Se precisar de `GCS_SERVICE_ACCOUNT_JSON`, guarde no Secret Manager e exponha ao serviço como secret.

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

## Checklist rápido antes de subir o app

1. `GCS_BUCKET_NAME` e `GCS_PROJECT_ID` definidos no serviço Cloud Run (e credenciais via ADC ou secret).
2. Service account de runtime com `objectAdmin` nos buckets e `serviceAccountTokenCreator`.
3. Origem do front (URL do Cloud Run e/ou domínio custom) presente no **CORS** do `submanager-prod-files`.
4. `NEXT_PUBLIC_APP_URL` (e demais URLs do app) apontando para o host público correto — ver `.env.example`.

---

*Valores de bucket, região, lifecycle e CORS foram obtidos com `gsutil` no projeto `submanager`. Atualize este arquivo se alterar buckets ou políticas no GCP.*
