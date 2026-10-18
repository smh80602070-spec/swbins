"""웹 3D 출처 없는 GLB 분류표 (K-0119) — 읽기만 한다.

  py -3 tools/asset-audit/models_inventory.py            → out/models_inventory.json + 표 요약(콘솔)
  py -3 tools/asset-audit/models_inventory.py --sheet F  → 사람 읽는 표를 F 에 쓴다

대상: 웹 다섯 판 `assets/models/**/*.{glb,gltf}` 중 옆 `<이름>.license.json` 이 없는 것.
각 파일을 둘 × 둘로 가른다.
  출처  self   = md5 가 자체 정본(`saga-assets/**`·license 있는 `saga-web/shared/assets/**`)과 같다
                 또는 `saga-assets/credits.json` groups 의 where 폴더 안
        borrow = 폴더·이름에 팩 표시(quaternius·kaykit·kenney·polypizza·oga·sketchfab·polyhaven·community·realistic·standin…)
                 또는 그 판 ASSET_LICENSES.md 가 그 폴더를 남의 팩으로 적음
        unknown = 위 둘 다 아님(손으로 본다)
  쓰임  used   = 파일 이름(확장자 뺀 줄기 포함)이 그 판 js·html·json 이나 shared/js 에 나온다(use_why `name`)
                 또는 이어 붙여 부른다 — 줄기 = <앞>[-_]<나머지> 이고 '<앞>-'(따옴표 문자열)과 '<나머지>'(목록 글자)가
                 둘 다 그 판 코드에 있다(`'character-' + letter`·`'avatar_sample_' + n`, use_why `prefix:<앞>`, K-0142)
                 또는 `tools/asset-forge/kitbash.py` 레시피 부품 `"file"` 이름(조립 입력, use_why `kitbash`)
        unused = 안 나온다
이름 대조라 참고용이다 — 지우기 전엔 웹 세션이 한 번 더 확인한다.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'asset-audit', 'out', 'models_inventory.json')
GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']
PACK = re.compile(r'quaternius|kaykit|kenney|polypizza|poly_pizza|oga_|opengameart|sketchfab|polyhaven|poly_haven|'
                  r'community|realistic|standin|ultimate|universal_base|synty|mixamo', re.I)
CODE_EXT = {'.js', '.mjs', '.html', '.json', '.css'}
QUOTED = re.compile(r"""['"]([A-Za-z0-9_.-]+)['"]""")


def kitbash_parts():
    return set(re.findall(r'"file":\s*"([^"]+)"', read(os.path.join('tools', 'asset-forge', 'kitbash.py'))))


def use_reason(name, stem, c, lits, kb):
    """쓰임 이유 — 'name' · 'prefix:<앞>' · 'kitbash' · ''(안 씀)"""
    if (name in c) or (re.search(r'(?<![A-Za-z0-9_])' + re.escape(stem) + r'(?![A-Za-z0-9])', c) is not None):
        return 'name'
    for i, ch in enumerate(stem):
        if ch in '-_' and 2 <= i < len(stem) - 1 and stem[:i + 1] in lits and stem[i + 1:] in lits:
            return 'prefix:' + stem[:i + 1]
    if name in kb:
        return 'kitbash'
    return ''


def git_files():
    out = subprocess.run(['git', 'ls-files', 'saga-web', 'saga-assets'], cwd=ROOT, capture_output=True).stdout
    return [l for l in out.decode('utf-8', 'replace').splitlines() if l]


def md5(p):
    h = hashlib.md5()
    with open(os.path.join(ROOT, p), 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def read(p):
    try:
        with open(os.path.join(ROOT, p), 'rb') as f:
            return f.read().decode('utf-8', 'replace')
    except OSError:
        return ''


SELF_HEAD = re.compile(r'자체|world-forge|char-forge|asset-forge|K-0\d|우리 도구|코드로|직접 빚은|직접 만든', re.I)
KNOWN = re.compile(r'Quaternius|Kenney|KayKit|Poly by Google|poly\.pizza|Poly Pizza|OpenGameArt|Sketchfab|Poly Haven|itch\.io|MPFB|MakeHuman|VRoid|Vitruvian|Mixamo|Synty', re.I)


def split_sections(doc):
    """`## 제목` 절로 나눔 → [(제목, 본문)]"""
    out, head, buf = [], '', []
    for line in doc.splitlines():
        if line.startswith('## '):
            if buf:
                out.append((head, '\n'.join(buf)))
            head, buf = line[3:].strip(), [line]
        else:
            buf.append(line)
    if buf:
        out.append((head, '\n'.join(buf)))
    return out


def doc_source(secs, name, stem, folder_path):
    """파일 이름 → 정확한 폴더 경로 순으로 그 이름이 나오는 첫 절 제목. 없으면 None"""
    for key in (name, folder_path):
        if not key:
            continue
        for head, body in secs:
            if key in body:
                h = head.split(' — ')[0].strip() or head
                if not KNOWN.search(h) and not SELF_HEAD.search(h):
                    m = KNOWN.search(body)
                    if m:
                        h = m.group(0) + ' (' + h + ')'
                return h
    return None


def main():
    files = git_files()
    fs = set(files)
    lic = {f[:-len('.license.json')] for f in files if f.endswith('.license.json')}
    is_model = lambda f: f.lower().endswith(('.glb', '.gltf'))

    # 자체 정본 md5 — saga-assets 전부 + license 붙은 shared 모델
    self_md5 = {}
    for f in files:
        if not is_model(f):
            continue
        if f.startswith('saga-assets/') or (f.startswith('saga-web/shared/assets/') and os.path.splitext(f)[0] in lic):
            self_md5.setdefault(md5(f), f)
    credits = json.load(open(os.path.join(ROOT, 'saga-assets', 'credits.json'), encoding='utf-8'))
    self_dirs = [w.rstrip('/') + '/' for g in credits.get('groups', []) for w in g.get('where', []) if w.startswith('saga-web/')]

    # 판별 코드 글(assets 밖) + 공용 js
    shared_code = '\n'.join(read(f) for f in files if f.startswith('saga-web/shared/') and '/assets/' not in f
                            and os.path.splitext(f)[1] in CODE_EXT)
    code = {}
    docs = {}
    for g in GAMES:
        pre = f'saga-web/{g}/'
        code[g] = shared_code + '\n'.join(read(f) for f in files if f.startswith(pre) and not f.startswith(pre + 'assets/')
                                          and os.path.splitext(f)[1] in CODE_EXT and '/vendor/' not in f
                                          and os.path.getsize(os.path.join(ROOT, f)) < 16 << 20)
        docs[g] = read(pre + 'assets/ASSET_LICENSES.md')
    sections = {g: split_sections(docs[g]) for g in GAMES}
    lits = {g: set(QUOTED.findall(code[g])) for g in GAMES}
    kb = kitbash_parts()

    rows = []
    for f in files:
        m = re.match(r'saga-web/(saga-[a-z]+)/assets/models/(.+)$', f)
        if not m or not is_model(f) or os.path.splitext(f)[0] in lic:
            continue
        g, sub = m.group(1), m.group(2)
        if g not in GAMES:
            continue
        name = os.path.basename(f)
        stem = os.path.splitext(name)[0]
        folder = os.path.dirname(sub)
        h = md5(f)
        why = ''
        if h in self_md5:
            src, why = 'self', 'md5=' + self_md5[h]
        elif any(f.startswith(d) for d in self_dirs):
            src, why = 'self', 'credits.json where'
        elif PACK.search(sub):
            src, why = 'borrow', 'pack:' + PACK.search(sub).group(0).lower()
        else:
            head = doc_source(sections[g], name, stem, 'models/' + folder + '/' if folder else None)
            if head is None:
                src, why = 'unknown', ''
            elif SELF_HEAD.search(head):
                src, why = 'self', 'doc: ' + head
            else:
                src, why = 'borrow', 'doc: ' + head
        c = code[g]
        uw = use_reason(name, stem, c, lits[g], kb)
        rows.append({'game': g, 'path': f, 'folder': folder, 'src': src, 'why': why,
                     'used': bool(uw), 'use_why': uw, 'md5': h, 'bytes': os.path.getsize(os.path.join(ROOT, f))})

    # 모름 → 다른 판의 같은 md5 사본 판정을 물려받는다(다섯 벌 복사라 한 판 문서에만 적힌 일이 많다)
    by_md5 = {}
    for r in rows:
        if r['src'] != 'unknown':
            by_md5.setdefault(r['md5'], r)
    for r in rows:
        if r['src'] == 'unknown' and r['md5'] in by_md5:
            o = by_md5[r['md5']]
            r['src'], r['why'] = o['src'], o['why'] + ' (사본 ' + o['game'] + ')'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cnt = Counter((r['src'], r['used']) for r in rows)
    summary = {f"{s}:{'used' if u else 'unused'}": n for (s, u), n in sorted(cnt.items())}
    json.dump({'total': len(rows), 'summary': summary, 'rows': rows}, open(OUT, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('total', len(rows), summary)
    byf = defaultdict(Counter)
    for r in rows:
        byf[(r['game'], r['folder'].split('/')[0])][f"{r['src']}:{'used' if r['used'] else 'unused'}"] += 1
    if '--sheet' in sys.argv:
        sheet = sys.argv[sys.argv.index('--sheet') + 1]
        write_sheet(sheet, rows, summary, byf)


def write_sheet(path, rows, summary, byf):
    keys = ['self:used', 'self:unused', 'borrow:used', 'borrow:unused', 'unknown:used', 'unknown:unused']
    L = ['# 웹 3D 출처 없는 GLB 분류표 (K-0119)', '',
         '정본 `tools/asset-audit/out/models_inventory.json`(커밋 안 함 — `py -3 tools/asset-audit/models_inventory.py` 로 다시 냄). '
         '이름 대조라 참고용 — 지우기 전 웹 세션이 한 번 더 본다.', '',
         f"합 {len(rows)} · " + ' · '.join(f'{k} {summary.get(k, 0)}' for k in keys), '',
         '| 판 | 폴더 | ' + ' | '.join(keys) + ' |', '|---|---|' + '---|' * len(keys)]
    for (g, top), c in sorted(byf.items()):
        L.append(f'| {g} | {top} | ' + ' | '.join(str(c.get(k, 0) or '') for k in keys) + ' |')
    L += ['', '## 빌림 출처별(쓰임+안 씀)', '']
    def label(r):
        w = r['why'].split(' (사본')[0]
        w = re.sub(r'^(doc|pack): ?', '', w)
        return re.split(r' [(\"]', w)[0].strip().lower()
    for k, n in Counter(label(r) for r in rows if r['src'] == 'borrow').most_common():
        L.append(f'- {k} {n}')
    L += ['', '## 빌림·쓰임(K-0122·K-0126 입력) — 폴더별', '']
    bu = Counter((r['game'], r['folder']) for r in rows if r['src'] == 'borrow' and r['used'])
    for (g, fo), n in sorted(bu.items()):
        L.append(f'- {g} `{fo}` {n}')
    L += ['', '## 모름(손으로 본 결과는 K-0119 메모)', '']
    uk = Counter((r['game'], r['folder']) for r in rows if r['src'] == 'unknown')
    for (g, fo), n in sorted(uk.items()):
        L.append(f'- {g} `{fo}` {n}')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
