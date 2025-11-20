#!/usr/bin/env python3
"""
Автоматическое обновление версии кеша в HTML файлах.
Запуск: python update_version.py
"""

import re
import subprocess
from datetime import datetime
from pathlib import Path

def get_git_hash():
    """Получить короткий git commit hash."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except:
        # Если git недоступен, используем timestamp
        return datetime.now().strftime('%Y%m%d-%H%M')

def update_version_in_file(file_path, js_file_pattern, new_version):
    """Обновить версию в HTML файле."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Паттерн для поиска: script.js?v=любая-версия"
        pattern = f'{js_file_pattern}\\?v=[^"]*"'
        replacement = f'{js_file_pattern}?v={new_version}"'

        new_content = re.sub(pattern, replacement, content)

        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'[OK] Updated: {file_path} -> v={new_version}')
            return True
        else:
            print(f'[WARN] Pattern not found in: {file_path}')
            return False
    except Exception as e:
        print(f'[ERROR] Failed to process {file_path}: {e}')
        return False

def main():
    """Главная функция."""
    # Получаем новую версию
    version = get_git_hash()
    print(f'\n[+] Updating cache version to: {version}\n')

    # Обновляем файлы
    updated = 0

    # Admin panel
    admin_index = Path('admin/index.html')
    if admin_index.exists():
        if update_version_in_file(admin_index, 'schedule.js', version):
            updated += 1

    # Client app
    client_index = Path('client/index.html')
    if client_index.exists():
        if update_version_in_file(client_index, 'app.js', version):
            updated += 1

    print(f'\n[SUCCESS] Updated {updated} file(s)')
    print(f'[INFO] Now commit changes: git add . && git commit -m "chore: bump version to {version}"')

if __name__ == '__main__':
    main()
