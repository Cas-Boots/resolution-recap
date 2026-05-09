import json, os, subprocess, sys

json_path = os.environ['BACKUP_FILE']
sqlite_path = sys.argv[1]

with open(json_path, 'r', encoding='utf-8') as f:
    jdata = json.load(f)

tables = ['seasons', 'people', 'metrics', 'entries', 'entry_audit', 'goals', 'achievements', 'countries_visited']
core_tables = ['seasons', 'people', 'metrics', 'entries']
failures = []

print(f"\n{'Table':<25} {'SQLite':<10} {'JSON':<10} Status")
print('-' * 55)

for table in tables:
    result = subprocess.run(
        ['sqlite3', sqlite_path, f'SELECT COUNT(*) FROM {table}'],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        failures.append(f'{table}: table missing from SQLite ({result.stderr.strip()})')
        print(f'{table:<25} {"missing":<10} {"-":<10} ERROR')
        continue
    sqlite_count = int(result.stdout.strip())
    json_count = len(jdata.get(table, []) or [])
    if sqlite_count != json_count:
        failures.append(f'{table}: SQLite={sqlite_count}, JSON={json_count}')
        status = 'MISMATCH'
    elif table in core_tables and sqlite_count == 0:
        failures.append(f'{table}: core table is empty')
        status = 'EMPTY'
    else:
        status = 'OK'
    print(f'{table:<25} {sqlite_count:<10} {json_count:<10} {status}')

print()
if failures:
    print('VERIFICATION FAILED:')
    for f in failures:
        print(f'  - {f}')
    sys.exit(1)

print('All checks passed.')
