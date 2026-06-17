from pathlib import Path
import re

root = Path('frontend/src')
modal_map = {
    420: 'modal-xs',
    500: 'modal-sm',
    520: 'modal-sm',
    540: 'modal-sm',
    560: 'modal-md',
    580: 'modal-md',
    600: 'modal-lg',
    640: 'modal-xl',
    700: 'modal-2xl',
    750: 'modal-2xl',
    780: 'modal-2xl',
}
pattern = re.compile(r'className="modal"\s+style=\{\{\s*maxWidth\s*:\s*([0-9]+)\s*\}\}')

files_changed = []
for path in sorted(root.rglob('*.tsx')):
    content = path.read_text(encoding='utf-8')
    new_content = content
    for match in list(pattern.finditer(content)):
        width = int(match.group(1))
        cls = modal_map.get(width, 'modal-lg')
        replacement = f'className="modal {cls}"'
        new_content = new_content.replace(match.group(0), replacement)
    if new_content != content:
        path.write_text(new_content, encoding='utf-8')
        files_changed.append(path.relative_to(root))

print('Updated files:')
for file in files_changed:
    print(file)
print(f'Total files updated: {len(files_changed)}')
