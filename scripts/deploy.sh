#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f env ]]; then
  echo "Missing env file. Copy env.example to env and fill in values."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./env
set +a

if [[ -z "${MONGODB_URI:-}" || -z "${JWT_SECRET:-}" ]]; then
  echo "MONGODB_URI and JWT_SECRET must be set in env"
  exit 1
fi

CLIENT_ORIGINS="${CLIENT_ORIGIN:-http://localhost:5173}"
if [[ "$CLIENT_ORIGINS" != *"job-application-smi-front-end.vercel.app"* ]]; then
  CLIENT_ORIGINS="${CLIENT_ORIGINS},https://job-application-smi-front-end.vercel.app"
fi

if [[ -z "${BACKUP_CRON_SCHEDULE:-}" ]]; then
  BACKUP_CRON_SCHEDULE='cron(30 19 * * ? *)'
fi

sam build
sam deploy \
  --no-confirm-changeset \
  --parameter-overrides \
    "MongoDbUri=${MONGODB_URI}" \
    "JwtSecret=${JWT_SECRET}" \
    "ClientOrigin=${CLIENT_ORIGINS}" \
    "BackupEmailTo=${BACKUP_EMAIL_TO:-}" \
    "BackupEmailFrom=${BACKUP_EMAIL_FROM:-}" \
    "SmtpHost=${SMTP_HOST:-}" \
    "SmtpPort=${SMTP_PORT:-587}" \
    "SmtpUser=${SMTP_USER:-}" \
    "SmtpPass=${SMTP_PASS:-}" \
    "SmtpSecure=${SMTP_SECURE:-false}" \
    "ParameterKey=BackupCronSchedule,ParameterValue=${BACKUP_CRON_SCHEDULE}"
