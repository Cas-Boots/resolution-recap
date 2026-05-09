import json, os, sys

path = os.environ['BACKUP_FILE']
with open(path, 'r', encoding='utf-8') as f:
    payload = json.load(f)

required = {'seasons', 'people', 'metrics', 'entries'}
if not isinstance(payload, dict) or not required.issubset(payload.keys()):
    sys.exit(f'Backup payload structure invalid in {path}')
