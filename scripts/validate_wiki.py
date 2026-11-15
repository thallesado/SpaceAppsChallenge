"""Validate relative Markdown links and JSON evidence without external dependencies."""
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
wiki = root / 'wiki'
errors = []
links = 0
pages = list(wiki.rglob('*.md'))
for page in pages:
    text = page.read_text(encoding='utf-8')
    if text.count('```') % 2:
        errors.append(f'Unclosed code fence: {page.relative_to(root)}')
    for match in re.finditer(r'(?<!!)\[[^\]]*\]\(([^)]+)\)', text):
        raw = match.group(1).strip().strip('<>')
        parsed = urlsplit(raw)
        if parsed.scheme or raw.startswith('#'):
            continue
        links += 1
        target = page.parent / unquote(parsed.path)
        if not target.exists():
            errors.append(f'{page.relative_to(root)} -> {raw}')
for path in (wiki / 'evidencias').glob('*.json'):
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, OSError) as exc:
        errors.append(f'{path.name}: {exc}')
if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print(f'Wiki OK: {len(pages)} pages, {links} relative links, JSON evidence readable.')
