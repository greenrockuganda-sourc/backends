import multiprocessing
import os

PORT = os.getenv('PORT', '8000')

# Railway instances are often small and memory-constrained. Keeping the default
# Gunicorn footprint low prevents the app from reserving a large amount of RAM
# even while idle.
CPU_CORES = max(1, multiprocessing.cpu_count() or 1)
workers = int(os.getenv('GUNICORN_WORKERS', '2'))
threads = int(os.getenv('GUNICORN_THREADS', '2'))

bind = f'0.0.0.0:{PORT}'
worker_class = 'gthread'
workers = max(1, min(workers, 2))
threads = max(1, min(threads, 4))
worker_connections = 1000
backlog = 2048
keepalive = 5
timeout = 30
granular_timeout = False
max_requests = 500
max_requests_jitter = 50
# preload_app keeps an extra copy of the app in memory; leave it off by
# default to reduce idle RAM usage on Railway.
preload_app = False
accesslog = '-'
errorlog = '-'
loglevel = 'info'
