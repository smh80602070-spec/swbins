#!/usr/bin/env python3
"""다섯 판 표시 이름 바꾸기 — 정본 `data/games.json` 의 old → name 을 살아 있는 글 파일 전부에 적용한다.

  py tools/rename-games.py            건드릴 파일·바뀔 자리 수만 센다(dry)
  py tools/rename-games.py --apply    실제로 바꾼다(바이너리 모드 — CRLF·BOM 그대로)

규칙(루트 CLAUDE.md·games.json `_`):
  - 표시 글자만. 폴더·세이브 키·앱 id·코드 식별자(saga_go·SagaGo·saga-go)는 ASCII 라 애초에 안 걸린다.
  - 이력(archive/ · tasks/*/done/ · *HANDOFF* · *HISTORY*)·생성물(dist/ · vendor/ · node_modules) · 바이너리는 건너뛴다.
    dist 번들은 바꾼 뒤 `node saga-web/shared/build/bundle.mjs <판>` 으로 다시 만든다(이 스크립트가 --apply 끝에 안내만 한다).
  - git 이 추적하는 파일만(다른 세션의 미추적 작업 파일을 먹지 않는다).
  - '사가고' 는 '사가고돗' 을 제외하는 정규식(games.json rename_rules.regex).
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, 'data', 'games.json')
TEXT_EXT = {'.json', '.js', '.mjs', '.cjs', '.ts', '.cs', '.md', '.gd', '.html', '.htm', '.py', '.css', '.sh', '.xml',
            '.txt', '.plist', '.gdshaderinc', '.gdshader', '.tscn', '.tres', '.bat', '.ps1', '.tsv', '.csv', '.yml', '.yaml',
            '.cfg', '.godot', '.svg', '.webmanifest', '.asmdef', '.uxml', '.uss', '.ini', '.toml'}
SKIP_DIR = ('archive/', '/done/', '/dist/', '/vendor/', 'node_modules/', '/_out/', '/_prof/', '.git/')
SKIP_NAME = ('HANDOFF', 'HISTORY')
SELF = ('tools/rename-games.py', 'data/games.json')


def load():
    with open(CFG, 'rb') as f:
        cfg = json.loads(f.read().decode('utf-8'))
    rx = cfg.get('rename_rules', {}).get('regex', {})
    pairs = []
    for g in cfg['games']:
        old, new = g['old'], g['name']
        if new.startswith(old):
            sys.exit(f'새 이름 {new} 이 옛 이름 {old} 으로 시작한다 — 되돌릴 수 없는 겹침(games.json rename_rules.note)')
        pat = rx.get(old, re.escape(old))
        pairs.append((old, new, re.compile(pat.encode('utf-8'))))
    return cfg, pairs


def tracked():
    out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True).stdout
    for p in out.split(b'\0'):
        if not p:
            continue
        s = p.decode('utf-8', 'surrogateescape')
        if any(k in ('/' + s) for k in SKIP_DIR) or any(k in os.path.basename(s) for k in SKIP_NAME) or s in SELF:
            continue
        if os.path.splitext(s)[1].lower() not in TEXT_EXT:
            continue
        yield s


def main():
    apply = '--apply' in sys.argv
    cfg, pairs = load()
    total = 0
    files = 0
    per_name = {o: 0 for o, _, _ in pairs}
    changed = []
    for rel in tracked():
        path = os.path.join(ROOT, rel)
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except OSError:
            continue
        if b'\0' in data[:4096]:
            continue
        new = data
        hit = 0
        for old, name, rxc in pairs:
            new, n = rxc.subn(name.encode('utf-8'), new)
            hit += n
            per_name[old] += n
        if hit:
            files += 1
            total += hit
            changed.append((rel, hit))
            if apply:
                with open(path, 'wb') as f:
                    f.write(new)
    for old, name, _ in pairs:
        print(f'{old:>6} → {name:<6} {per_name[old]:5d}')
    print(f'파일 {files}개 · 자리 {total}개 ' + ('바꿈' if apply else '(dry — --apply 로 실행)'))
    if '--list' in sys.argv:
        for rel, n in sorted(changed, key=lambda x: -x[1]):
            print(f'{n:5d} {rel}')
    if apply:
        print('다음: node saga-web/shared/build/bundle.mjs <판> ×5 · sw.js VERSION ×5 · bash tools/precheck.sh')


if __name__ == '__main__':
    main()
