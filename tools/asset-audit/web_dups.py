"""웹 배치 중복 감사 (K-0156) — 같은 내용(blob)이 saga-web 안에 2벌 이상 놓인 파일을 묶어 표로 낸다. 읽기만 한다.

    py tools/asset-audit/web_dups.py              → out/web_dups.json · out/web_dups.md · out/web_dups_place_draft.json, 끝 줄 WEB_DUPS
    py tools/asset-audit/web_dups.py --top 5      → 초안에 넣을 상위 place 항목 수(기본 3)

재료  `git ls-tree -r -l HEAD saga-web` 만 쓴다(du·find 로 saga-web 를 훑지 않는다 — 2분 넘게 멈춤).
묶음  blob 해시가 같은 파일 2벌 이상 = 한 묶음, 여분 = (벌 수 − 1) × 크기.
짝    묶음의 각 벌을 `tools/asset-place/asset-place.json` 의 web target dir(+include 무늬)에 짝지운다. 벌이 가장 많이 걸린 항목이
      그 묶음의 항목. 하나도 안 걸리면 "손:<판 안 상대 폴더>"(예 `손:assets/models`) — 손으로 복사해 둔 것.
못 모음 판 안 상대 경로(`assets/models/x.glb`)가 같은데 다른 판에선 **다른 내용**이면 shared 한 이름으로 못 합친다 → 표 ①·초안에서 뺀다.
코드  `reflect.py` 엄격 기준과 같은 "그리는 코드만"(웹 .js/.mjs/.html, `*ids.js`·.json·assets/ 안 파일 제외)을 판 폴더·shared 에서 git 목록으로 읽어
      ③ 묶음 줄기(확장자 뺀 이름)가 나오는 줄 수 · ④ 항목 폴더 글자(판 안 상대 경로, 예 `assets/portraits/hero`)가 나오는 줄 수 = shared 로 옮길 때 고칠 자리.
      줄 수만 센다 — 글자를 이어 붙여 만드는 경로는 못 잡는다(참고용, 옮기기 전 웹이 확인).
세이브 키·도감 id 는 파일 경로가 아니라 data.js 글자라 이 감사와 무관하다(경로만 바뀜).
"""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'out')
MANIFEST = os.path.join(ROOT, 'tools', 'asset-place', 'asset-place.json')
WEB_GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']
STRICT_EXT = {'.js', '.mjs', '.html'}
TABLE_NAME = re.compile(r'(-ids\.js$|ids\.js$|^manifest.*\.json$|\.json$)', re.I)
TOKEN = re.compile(r'[A-Za-z0-9_-]+')
MB = 1 << 20


def git(*args, text=True):
    return subprocess.run(['git', '-C', ROOT, *args], capture_output=True, check=True,
                          text=text, encoding='utf-8' if text else None).stdout


def ls_tree():
    rows = []
    for ln in git('-c', 'core.quotepath=off', 'ls-tree', '-r', '-l', '-z', 'HEAD', 'saga-web').split('\0'):
        if not ln:
            continue
        meta, path = ln.split('\t', 1)
        mode, kind, sha, size = meta.split()
        if kind != 'blob' or size == '-':
            continue
        rows.append((path, sha, int(size)))
    return rows


def split_game(path):
    """saga-web/<판>/<rest> → (판, rest). 판 = WEB_GAMES 또는 'shared' 또는 '(기타)'."""
    p = path.split('/')
    top = p[1] if len(p) > 2 else '(기타)'
    if top in WEB_GAMES or top == 'shared':
        return top, '/'.join(p[2:])
    return '(기타)', '/'.join(p[1:])


def place_items():
    items = json.load(open(MANIFEST, encoding='utf-8'))['items']
    out = []
    for it in items:
        dirs = [t['dir'].replace('\\', '/').rstrip('/') for t in it['targets'] if t.get('track') == 'web']
        if not dirs:
            continue
        inc = it.get('include') or ['*']
        renames = set()
        for t in it['targets']:
            renames |= set((t.get('rename') or {}).values())
        spec = sum(1 for g in inc if g != '*')   # 좁은 무늬 항목을 먼저(같은 폴더 world3d 둘)
        out.append({'id': it['id'], 'dirs': dirs, 'include': inc, 'renames': renames, 'spec': spec})
    out.sort(key=lambda x: -x['spec'])
    return out


def match_item(path, items):
    low = path.lower()
    base = os.path.basename(low)
    best = None
    for it in items:
        for d in it['dirs']:
            dl = d.lower() + '/'
            if not low.startswith(dl) or '/' in low[len(dl):]:
                continue
            if base in {r.lower() for r in it['renames']} or any(fnmatch.fnmatch(base, g.lower()) for g in it['include']):
                if best is None or len(d) > len(best[1]):
                    best = (it['id'], d)
    return best


def code_files(paths):
    """판별 엄격 코드 파일 목록(git 추적분) — {판: [path]}. 판 폴더·shared 각자."""
    out = defaultdict(list)
    for p in paths:
        g, rest = split_game(p)
        if g == '(기타)':
            continue
        ext = os.path.splitext(p)[1].lower()
        base = os.path.basename(p)
        if ext not in STRICT_EXT or TABLE_NAME.search(base) or base.startswith('.'):
            continue
        parts = rest.split('/')
        if parts[0] in ('assets', 'node_modules', 'dist', 'mobile', 'server', '_wip') or 'audio' == parts[0]:
            continue
        out[g].append(p)
    return out


def load_lines(files):
    """{판: [(path, lineno, text)]} + 토큰 색인 {판: {token: set(idx)}}."""
    lines, index = {}, {}
    for g, fs in files.items():
        L, I = [], defaultdict(set)
        for p in fs:
            try:
                txt = open(os.path.join(ROOT, p), encoding='utf-8', errors='replace').read()
            except OSError:
                continue
            if len(txt) > 8 * MB:
                continue
            for n, t in enumerate(txt.splitlines(), 1):
                k = len(L)
                L.append((p, n, t))
                for tok in set(TOKEN.findall(t)):
                    I[tok].add(k)
        lines[g], index[g] = L, I
    return lines, index


def stem_hits(stem, g, lines, index):
    if TOKEN.fullmatch(stem):
        return len(index.get(g, {}).get(stem, ()))
    return sum(1 for _, _, t in lines.get(g, ()) if stem in t)


def dir_hits(rel_dir, g, lines):
    return [(p, n) for p, n, t in lines.get(g, ()) if rel_dir in t]


def run(args):
    rows = ls_tree()
    paths = [r[0] for r in rows]
    total_mb = sum(r[2] for r in rows) / MB
    by_sha = defaultdict(list)
    for p, sha, size in rows:
        by_sha[sha].append((p, size))
    # 같은 판 안 상대 경로 → blob 들(못 모음 판정)
    rel_blobs = defaultdict(set)
    sha_of = {}
    for p, sha, size in rows:
        g, rest = split_game(p)
        rel_blobs[rest.lower()].add(sha)
        sha_of[p] = sha
    items = place_items()
    files = code_files(paths)
    lines, index = load_lines(files)

    groups = []
    for sha, cps in by_sha.items():
        if len(cps) < 2:
            continue
        size = cps[0][1]
        copies = []
        votes = Counter()
        for p, _ in cps:
            g, rest = split_game(p)
            m = match_item(p, items)
            key = m[0] if m else '손:' + (os.path.dirname(rest) or '.')
            if not m:   # 손 배치는 둘째 층까지만(assets/models/beasts → assets/models)
                d = os.path.dirname(rest).split('/')
                key = '손:' + '/'.join(d[:2]) if d != [''] else '손:.'
            votes[key] += 1
            copies.append({'path': p, 'game': g, 'rel': rest, 'item': key})
        item = votes.most_common(1)[0][0]
        games = sorted({c['game'] for c in copies})
        conflict = sorted({c['rel'] for c in copies if len(rel_blobs[c['rel'].lower()]) > 1})
        stem = os.path.splitext(os.path.basename(copies[0]['path']))[0]
        refs = {g: stem_hits(stem, g, lines, index) for g in games}
        groups.append({'sha': sha, 'size': size, 'n': len(copies), 'extra': size * (len(copies) - 1),
                       'item': item, 'games': games, 'shared_only': games == ['shared'],
                       'conflict': conflict, 'mergeable': not conflict, 'stem': stem, 'refs': refs,
                       'copies': copies})
    groups.sort(key=lambda x: -x['extra'])
    extra_all = sum(g['extra'] for g in groups)

    # ① 항목별
    per_item = defaultdict(lambda: {'groups': 0, 'copies': 0, 'extra': 0, 'blocked_groups': 0, 'blocked_extra': 0,
                                    'dirs': set(), 'small_groups': 0, 'refs': 0})
    for g in groups:
        r = per_item[g['item']]
        if g['mergeable']:
            r['groups'] += 1
            r['copies'] += g['n']
            r['extra'] += g['extra']
            r['refs'] += sum(g['refs'].values())
            if g['extra'] < MB:
                r['small_groups'] += 1
        else:
            r['blocked_groups'] += 1
            r['blocked_extra'] += g['extra']
        for c in g['copies']:
            r['dirs'].add((c['game'], os.path.dirname(c['rel'])))
    # ④ 고칠 코드 자리: 항목이 걸친 (판, 상대 폴더) 마다 그 폴더 글자가 나오는 줄
    for k, r in per_item.items():
        spots = set()
        for g, d in r['dirs']:
            if g == 'shared' or not d or d.split('/')[0] not in ('assets', 'audio'):
                continue   # js·build 같은 코드 폴더 글자는 모든 줄에 나와 자리 수가 무의미
            for hit in dir_hits(d, g, lines):
                spots.add(hit)
        r['code_spots'] = len(spots)
        r['spot_files'] = sorted(Counter(p for p, _ in spots).items(), key=lambda x: -x[1])[:6]
        r['dirs'] = sorted(f'{g}/{d}' for g, d in r['dirs'])
    item_rows = sorted(per_item.items(), key=lambda x: -x[1]['extra'])
    merge_extra = sum(r['extra'] for _, r in item_rows)
    top10 = sum(r['extra'] for _, r in item_rows[:10])

    # ② 판 폴더별(그 판에 놓인 여분 벌 — 묶음마다 첫 벌은 남긴다고 보고 나머지를 판에 나눈다: 판별 벌 수 기준)
    per_game = defaultdict(lambda: {'copies': 0, 'bytes': 0})
    for g in groups:
        for c in g['copies']:
            per_game[c['game']]['copies'] += 1
            per_game[c['game']]['bytes'] += g['size']
    shared_dup = [g for g in groups if g['shared_only']]

    # 초안: 상위 N 항목(place 항목 실명만, 손 배치 제외)
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    by_id = {it['id']: it for it in manifest['items']}
    draft = {'note': 'K-0156 초안 — asset-place.json 은 안 고쳤다. 웹이 코드 경로를 shared 로 바꾼 뒤 K 가 이 targets 로 갈아 끼운다.',
             'items': []}
    for k, r in item_rows:
        if len(draft['items']) >= args.top:
            break
        if k.startswith('손:') or k not in by_id:
            continue
        it = json.loads(json.dumps(by_id[k]))
        web = [t for t in it['targets'] if t.get('track') == 'web']
        rest_t = [t for t in it['targets'] if t.get('track') != 'web']
        have = [t for t in web if t['dir'].replace(chr(92), '/').startswith('saga-web/shared/')]
        rels = sorted({split_game(t['dir'])[1] for t in web if t not in have})
        new = have[0] if have else {'track': 'web', 'dir': 'saga-web/shared/' + (rels[0] if rels else 'assets/' + k)}
        it['targets'] = [new] + rest_t
        it['_k0156'] = {'old_web_dirs': [t['dir'] for t in web], 'extra_mb': round(r['extra'] / MB, 2),
                        'code_spots': r['code_spots'],
                        'rename_dropped': any(t.get('rename') for t in web)}
        draft['items'].append(it)

    os.makedirs(OUT, exist_ok=True)
    js = {'total_mb': round(total_mb, 1), 'groups': len(groups), 'extra_copies': sum(g['n'] - 1 for g in groups),
          'extra_mb': round(extra_all / MB, 1), 'mergeable_extra_mb': round(merge_extra / MB, 1),
          'blocked_groups': sum(1 for g in groups if not g['mergeable']),
          'blocked_extra_mb': round(sum(g['extra'] for g in groups if not g['mergeable']) / MB, 1),
          'shared_only_extra_mb': round(sum(g['extra'] for g in shared_dup) / MB, 1),
          'top10_share': round(top10 / merge_extra, 3) if merge_extra else 0,
          'items': {k: {**r, 'extra_mb': round(r['extra'] / MB, 2)} for k, r in item_rows},
          'games': per_game, 'groups_list': groups}
    with open(os.path.join(OUT, 'web_dups.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(js, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'web_dups_place_draft.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(draft, f, ensure_ascii=False, indent=2)

    def mb(b):
        return f'{b / MB:.1f}'
    md = ['# 웹 배치 중복 (K-0156) — `py tools/asset-audit/web_dups.py`', '',
          f'saga-web 추적 {total_mb:.0f}MB · 같은 blob 2벌 이상 **{len(groups)}묶음 · 여분 {js["extra_copies"]}벌 · {mb(extra_all)}MB** '
          f'· 모을 수 있음 {mb(merge_extra)}MB · 못 모음(같은 이름 다른 내용) {js["blocked_groups"]}묶음 {js["blocked_extra_mb"]}MB '
          f'· shared 안끼리 {len(shared_dup)}묶음 {js["shared_only_extra_mb"]}MB · 상위 10 항목 = 모을 수 있는 여분의 {js["top10_share"] * 100:.0f}%', '',
          '"손:<폴더>" = asset-place 항목에 안 걸린 손 배치. 코드 자리 = 그 판 그리는 코드에서 항목 폴더 글자(판 안 상대 경로)가 나오는 줄 수(이어 붙인 경로는 못 잡음).', '',
          '## ① place 항목별 여분(모을 수 있는 것만, MB 순)', '',
          '| 항목 | 여분 MB | 묶음 | 벌 | 1MB 미만 묶음 | 줄기 참조 줄 | 고칠 코드 자리 | 못 모음 묶음(MB) | 폴더 |', '|---|---:|---:|---:|---:|---:|---:|---:|---|']
    for k, r in item_rows:
        if not r['groups'] and not r['blocked_groups']:
            continue
        dirs = ', '.join(r['dirs'][:6]) + (f' 외 {len(r["dirs"]) - 6}' if len(r['dirs']) > 6 else '')
        md.append(f'| {k} | {mb(r["extra"])} | {r["groups"]} | {r["copies"]} | {r["small_groups"]} | {r["refs"]} | {r["code_spots"]} '
                  f'| {r["blocked_groups"]}({mb(r["blocked_extra"])}) | {dirs} |')
    md += ['', '## ② 판 폴더별(중복 묶음에 든 벌)', '', '| 판 | 벌 | MB |', '|---|---:|---:|']
    for g, r in sorted(per_game.items(), key=lambda x: -x[1]['bytes']):
        md.append(f'| {g} | {r["copies"]} | {mb(r["bytes"])} |')
    md += ['', '## ③ 큰 묶음 상위 25(코드 줄기 참조 줄 = 판별)', '', '| 줄기 | 크기 MB | 벌 | 여분 MB | 항목 | 판별 참조 줄 | 모음 |', '|---|---:|---:|---:|---|---|---|']
    for g in groups[:25]:
        refs = ' '.join(f'{k.replace("saga-", "")}:{v}' for k, v in g['refs'].items())
        md.append(f'| {g["stem"]} | {mb(g["size"])} | {g["n"]} | {mb(g["extra"])} | {g["item"]} | {refs} | {"○" if g["mergeable"] else "✗ 이름 충돌"} |')
    md += ['', '## ④ 상위 10 항목 — shared 로 옮길 때 고칠 코드 파일(줄 수 많은 순)', '']
    for k, r in item_rows[:10]:
        code_dir = k.startswith('손:') and k[2:].split('/')[0] not in ('assets', 'audio')
        fs = ', '.join(f'`{p}`({n})' for p, n in r['spot_files']) or (
            '(코드 파일 복사본 — 판별 복사본 규칙, 모으지 않음)' if code_dir else '(폴더 글자 안 나옴 — 이어 붙이는 경로, 손으로 찾을 것)')
        md.append(f'- **{k}** −{mb(r["extra"])}MB · 자리 {r["code_spots"]} · {fs}')
    if shared_dup:
        md += ['', '## shared 안끼리 겹침(따로 — 판 코드 무관, shared 안 정리)', '', '| 줄기 | 여분 MB | 벌 | 경로 |', '|---|---:|---:|---|']
        for g in shared_dup[:15]:
            md.append(f'| {g["stem"]} | {mb(g["extra"])} | {g["n"]} | {", ".join(c["rel"] for c in g["copies"][:3])} |')
    blocked = [g for g in groups if not g['mergeable']]
    if blocked:
        md += ['', '## 못 모음(①에서 뺌) — 같은 상대 경로가 다른 판에선 다른 내용(상위 10) · 같은 내용 벌만 shared 로 모으고 다른 판은 제 것을 두면 가능(웹 판단)', '']
        for g in blocked[:10]:
            md.append(f'- {g["stem"]} {mb(g["extra"])}MB · {", ".join(g["conflict"][:3])}')
    md += ['', f'초안(상위 {args.top} 항목 targets → shared): `tools/asset-audit/out/web_dups_place_draft.json` — '
           + ', '.join(f'{d["id"]} → {d["targets"][0]["dir"]}' for d in draft['items']),
           '', '권고: ① 위에서부터 웹이 코드 경로를 shared 로 바꾸고 판 복사본을 지운 뒤 K 가 place 를 초안대로 갱신 · 1MB 미만 묶음은 뒤로 · 세이브 키·도감 id 무관(경로만).',
           '', f'WEB_DUPS groups={len(groups)} extra_mb={extra_all / MB:.0f}']
    with open(os.path.join(OUT, 'web_dups.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(md) + '\n')
    for k, r in item_rows[:10]:
        print(f'{k:28s} {mb(r["extra"]):>7s}MB groups={r["groups"]} spots={r["code_spots"]}')
    print(f'top10={js["top10_share"]} mergeable={mb(merge_extra)}MB blocked={js["blocked_extra_mb"]}MB shared_only={js["shared_only_extra_mb"]}MB')
    print(f'WEB_DUPS groups={len(groups)} extra_mb={extra_all / MB:.0f}')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--top', type=int, default=3, help='초안에 넣을 상위 place 항목 수')
    run(ap.parse_args())


if __name__ == '__main__':
    main()
