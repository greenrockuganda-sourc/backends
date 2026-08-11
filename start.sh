#!/usr/bin/env bash
set -euo pipefail
python manage.py migrate
python manage.py collectstatic --noinput
DEFAULT_PORT=8000
if [[ -z "${PORT:-}" || "${PORT}" == '$PORT' || ! "${PORT}" =~ ^[0-9]+$ ]]; then
  echo "PORT is unset or invalid ('${PORT:-<empty>}'), falling back to ${DEFAULT_PORT}"
  PORT=${DEFAULT_PORT}
fi
exec gunicorn backend.wsgi --bind "0.0.0.0:${PORT}" --log-file -
