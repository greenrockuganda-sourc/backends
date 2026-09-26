import multiprocessing
import os

PORT = os.getenv('PORT', '8000')
workers = int(os.getenv('GUNICORN_WORKERS', str(max(2, multiprocessing.cpu_count() * 2))))
threads = int(os.getenv('GUNICORN_THREADS', '4'))

bind = f'0.0.0.0:{PORT}'
worker_class = 'gthread'
workers = max(2, min(workers, 12))
threads = max(2, min(threads, 8))
worker_connections = 1000
backlog = 2048
keepalive = 5
timeout = 30
granular_timeout = False
max_requests = 500
max_requests_jitter = 50
preload_app = True
accesslog = '-' 
errorlog = '-' 
loglevel = 'info'
