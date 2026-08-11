#!/usr/bin/env sh
set -eu

python manage.py migrate
python manage.py collectstatic --noinput

DEFAULT_PORT=8000
PORT=${PORT:-}
case "$PORT" in
  ''|*[!0-9]*)
    echo "PORT is unset or invalid ('${PORT:-<empty>}'), falling back to ${DEFAULT_PORT}"
    PORT=$DEFAULT_PORT
    ;;
  *)
    ;;
esac

exec gunicorn backend.wsgi --bind "0.0.0.0:${PORT}" --log-file -
