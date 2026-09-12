 LOG  [API] Loaded products count: 8import subprocess, sys

with open('c:/Users/Mroke/Desktop/backend/backend-auth-fix/store/serializers.py', encoding='utf-8') as f:
    lines = f.readlines()

start = None
for i, l in enumerate(lines):
    if 'class ProductSerializer' in l:
        start = i
        break

if start is not None:
    for i in range(start, min(start + 40, len(lines))):
        print(f'{i+1:4d} | {lines[i]}', end='')
