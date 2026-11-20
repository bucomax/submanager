#!/usr/bin/env bash
# Cria/atualiza os jobs do Cloud Scheduler que substituem os crons do vercel.json no Cloud Run.
#
# Fonte única: lê `crons[]` (path + schedule) do vercel.json — a Vercel interpreta o schedule em UTC,
# então os jobs usam time-zone UTC e os mesmos horários. Idempotente: roda quantas vezes quiser
# (cria o job se não existe, atualiza se existe — útil também para rotacionar o CRON_SECRET).
#
# Uso:
#   APP_URL=https://submanager-714014611104.us-east4.run.app PROJECT_ID=bucomax-497005 \
#     ./scripts/cloud-scheduler-setup.sh
#
# Variáveis:
#   APP_URL           (obrigatória) URL pública do serviço, sem path.
#   PROJECT_ID        projeto GCP; default = `gcloud config get-value project`.
#   REGION            região do Cloud Scheduler; default us-east4 (mesma do Cloud Run).
#   CRON_SECRET_NAME  secret no Secret Manager com o CRON_SECRET; default CRON_SECRET.
#   JOB_PREFIX        prefixo do nome dos jobs; default submanager.
#
# Pré-requisitos: gcloud autenticado, node (lê o vercel.json), API cloudscheduler.googleapis.com
# habilitada e permissão para ler o secret (roles/secretmanager.secretAccessor) e administrar jobs
# (roles/cloudscheduler.admin). A rota autentica por `Authorization: Bearer <CRON_SECRET>`
# (src/lib/auth/cron-auth.ts); o serviço é público, então não há OIDC.
#
# Sem retry automático (default do Scheduler): em modo inline (sem Redis) o cron não tem dedupe,
# e repetir uma execução que estourou o prazo duplicaria e-mails.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_URL="${APP_URL:-}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-east4}"
CRON_SECRET_NAME="${CRON_SECRET_NAME:-CRON_SECRET}"
JOB_PREFIX="${JOB_PREFIX:-submanager}"

fail() {
  echo "erro: $*" >&2
  exit 1
}

[[ -n "$APP_URL" ]] || fail "defina APP_URL (ex.: https://meu-servico-xxxx.us-east4.run.app)"
[[ -n "$PROJECT_ID" ]] || fail "defina PROJECT_ID ou configure um projeto padrão no gcloud"
[[ "$APP_URL" == https://* ]] || fail "APP_URL deve começar com https://"
APP_URL="${APP_URL%/}"

command -v gcloud >/dev/null || fail "gcloud não encontrado no PATH"
command -v node >/dev/null || fail "node não encontrado no PATH (necessário para ler o vercel.json)"

# O valor entra em `--headers/--update-headers KEY=VALUE[,KEY=VALUE]`: vírgula quebraria o parse (hex/base64 não têm).
CRON_SECRET_VALUE="$(gcloud secrets versions access latest --secret="$CRON_SECRET_NAME" --project="$PROJECT_ID")"
[[ -n "$CRON_SECRET_VALUE" ]] || fail "secret $CRON_SECRET_NAME está vazio"
[[ "$CRON_SECRET_VALUE" != *,* ]] || fail "CRON_SECRET contém vírgula; gere outro (openssl rand -hex 32)"

job_exists() {
  gcloud scheduler jobs describe "$1" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1
}

# `--format=none` evita imprimir o job (o recurso devolvido inclui o header com o secret).
# `create http` aceita `--headers`; `update http` só `--update-headers` (mescla por chave).
upsert_job() {
  local name="$1" schedule="$2" url="$3" action headers_flag
  if job_exists "$name"; then
    action="update"
    headers_flag="--update-headers"
  else
    action="create"
    headers_flag="--headers"
  fi

  gcloud scheduler jobs "$action" http "$name" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --schedule="$schedule" \
    --time-zone="UTC" \
    --uri="$url" \
    --http-method=GET \
    "${headers_flag}=Authorization=Bearer ${CRON_SECRET_VALUE}" \
    --attempt-deadline=300s \
    --format=none \
    --quiet

  echo "ok: ${action} ${name} (${schedule} UTC) -> ${url}"
}

crons="$(node -e 'for (const c of require("./vercel.json").crons ?? []) console.log(`${c.path}\t${c.schedule}`)')"
[[ -n "$crons" ]] || fail "nenhum cron encontrado em vercel.json"

while IFS=$'\t' read -r path schedule; do
  [[ -n "$path" ]] || continue
  upsert_job "${JOB_PREFIX}-$(basename "$path")" "$schedule" "${APP_URL}${path}"
done <<<"$crons"
