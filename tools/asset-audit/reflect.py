"""
에셋 반영 검사기(K-0073) — 정본 `saga-assets/` 파일이 세 트랙 코드에 **이름으로 닿는지** 기계로 센다. 읽기만 한다.

    py tools/asset-audit/reflect.py                 # 범주×트랙 표 두 벌(느슨/엄격) + 안 쓰는 목록 → out/reflect.md, 끝 줄 REFLECT
    py tools/asset-audit/reflect.py --categories    # 빠른 판: 정본 범주 이름이 어느 트랙 코드에도 없으면 WARN 한 줄(precheck 용)

기준 셋
  느슨  트랙 폴더 안 모든 코드·표(js·html·json·manifest·tscn·tres·cs·prefab…, 트랙에 복사된 에셋 폴더의 manifest 포함)에 파일 이름(확장자 뺀 줄기)이 한 번이라도 나오면 "쓰임".
  엄격  **그리는 코드만**(웹 .js/.mjs/.html, 고돗 .gd/.tscn/.tres/.gdshader, 유니티 .cs/.prefab/.unity/.asset/.mat) — `*-ids.js`·`*ids.js`·`manifest*.json`·`.json` 은 이름 표라 제외,
        트랙 에셋 폴더 안 파일도 제외. 아이템 id·소품 kind 로 **표를 돌며 읽는** 코드는 이름이 안 나와 과소 집계 — 진짜 답은 셋째 기준.
  요청  `saga-web/tools/playcheck/net-log.mjs` 가 남긴 `out/netlog_<판>.json`(헤드리스로 데모 장면을 열었을 때 실제 요청된 경로)이 있으면 웹 열에 "요청됨" 수를 함께 센다.

범주 = `tools/asset-place/asset-place.json` 의 src 폴더(없는 폴더는 정본 첫 폴더 이름). 트랙 코드 폴더는 audit.py 의 tracks() 와 같다.
"""
import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from audit import ROOT, ASSET_EXT, WEB_GAMES, tracks, walk, read, rel  # noqa: E402

OUT = os.path.join(HERE, 'out')
CANON = os.path.join(ROOT, 'saga-assets')
MANIFEST = os.path.join(ROOT, 'tools', 'asset-place', 'asset-place.json')

STRICT_EXT = {'web': {'.js', '.mjs', '.html'},
              'godot': {'.gd', '.tscn', '.tres', '.gdshader'},
              'unity': {'.cs', '.prefab', '.unity', '.asset', '.mat'}}
TABLE_NAME = re.compile(r'(-ids\.js$|ids\.js$|^manifest.*\.json$|\.json$)', re.I)
TOKEN = re.compile(r'[A-Za-z0-9_-]+')


def categories():
    """정본 폴더 → 범주 이름. 배치 표의 src 가 있으면 그 폴더(web2d/bg 처럼 둘째 층까지), 없으면 첫 폴더."""
    srcs = []
    try:
        for it in json.load(open(MANIFEST, encoding='utf-8'))['items']:
            s = it['src'].replace('\\', '/')
            if s.startswith('saga-assets/'):
                srcs.append(s[len('saga-assets/'):].rstrip('/'))
    except (OSError, KeyError, ValueError):
        pass
    srcs.sort(key=len, reverse=True)

    def of(rp):   # rp = saga-assets 아래 상대 경로
        for s in srcs:
            if rp.startswith(s + '/'):
                return s
        return rp.split('/')[0]
    return of


def canon_files():
    out = []
    for p in walk(CANON):
        if os.path.splitext(p)[1].lower() in ASSET_EXT:
            out.append(os.path.relpath(p, CANON).replace('\\', '/'))
    return sorted(out)


def tokens_of(text):
    return set(TOKEN.findall(text))


def track_tokens(t):
    """(느슨 토큰, 엄격 토큰). 느슨 = audit 의 code_ext 전부(에셋 폴더 포함) · 엄격 = 그리는 코드만, 이름 표·에셋 폴더 제외."""
    loose, strict = set(), set()
    sext = STRICT_EXT[t['kind']]
    adir = os.path.normpath(t['asset_dir'])
    for d in t['code_dirs']:
        for p in walk(d, skip=t['code_skip'] | {'node_modules', 'Library', 'Temp', 'Logs', 'obj'}):
            ext = os.path.splitext(p)[1].lower()
            if ext not in t['code_ext'] or os.path.getsize(p) > 64 << 20:
                continue
            base = os.path.basename(p)
            if base.startswith('.'):
                continue
            tk = tokens_of(read(p))
            loose |= tk
            if ext in sext and not TABLE_NAME.search(base) and not os.path.normpath(p).startswith(adir + os.sep):
                strict |= tk
    return loose, strict


def netlog_requested():
    """out/netlog_<판>.json → 판별 요청된 에셋 줄기 집합(웹 셋째 기준)."""
    req = {}
    for g in WEB_GAMES:
        p = os.path.join(OUT, f'netlog_{g}.json')
        if not os.path.exists(p):
            continue
        try:
            j = json.load(open(p, encoding='utf-8'))
        except ValueError:
            continue
        stems = set()
        for u in j.get('requested', []):
            stems.add(os.path.splitext(os.path.basename(u))[0])
            stems.add(os.path.basename(os.path.dirname(u)))   # 흔한 이름(attack…)은 부모 폴더로 맞춘다
        req[g] = stems
    return req


def stem(rp):
    return os.path.splitext(os.path.basename(rp))[0]


GENERIC = set()   # 흔한 이름(attack·death·btn…) — mark_generic 규칙, 부모 폴더 이름으로 대조하거나 판정 불가
PARENT_OK = set()  # 부모 폴더 이름이 정본 안에서 하나뿐이고 판 이름이 아니면(dj_doseo…) 그 이름으로 대조할 수 있다
GAME_WORDS = {'go', 'dungeon', 'forest', 'story', 'realm', 'web', 'godot', 'unity', 'shared', 'common', 'content', 'icon64', 'icon128', 'frames'}


def mark_generic(files):
    seen, tops, parents = defaultdict(set), defaultdict(set), defaultdict(set)
    for f in files:
        seen[stem(f)].add(os.path.dirname(f))
        tops[stem(f)].add(f.split('/')[0])
        parents[os.path.basename(os.path.dirname(f))].add(os.path.dirname(f))
    # 흔한 이름 = 상위 범주 셋 이상에 나오거나(icon·bg…), 한 범주 안 폴더 다섯 이상에 되풀이(인물마다 attack.webp, 판마다 btn.png).
    # 같은 물건의 세 형식(world/toon·web·sprite 의 같은 줄기)은 폴더 셋뿐이라 흔한 이름이 아니다.
    GENERIC.update(k for k, v in seen.items() if len(tops[k]) >= 3 or len(v) >= 5)
    PARENT_OK.update(k for k, v in parents.items() if len(v) == 1 and len(k) >= 5 and k not in GAME_WORDS)


def keys_of(rp):
    """대조할 토큰들. 빈 목록 = 흔한 이름이라 판정 불가(ambiguous)."""
    s = stem(rp)
    if s in GENERIC:
        parent = os.path.basename(os.path.dirname(rp))
        return [parent] if parent in PARENT_OK else []
    return [s, os.path.basename(rp)]


def ambiguous(rp):
    return not keys_of(rp)


def hit(rp, toks):
    return any(k in toks for k in keys_of(rp))


def run(args):
    t0 = time.time()
    cat_of = categories()
    files = canon_files()
    mark_generic(files)
    cats = defaultdict(list)
    for f in files:
        cats[cat_of(f)].append(f)
    trs = tracks({'web', 'godot', 'unity'}, None)
    tok = {}
    for t in trs:
        tok[t['id']] = track_tokens(t)
    web_ids = [t['id'] for t in trs if t['kind'] == 'web']
    cols = ['web', 'godot', 'unity']   # 웹은 다섯 판 합집합

    def union(kind, i):
        s = set()
        for t in trs:
            if t['kind'] == kind:
                s |= tok[t['id']][i]
        return s
    L = {c: union(c, 0) for c in cols}
    S = {c: union(c, 1) for c in cols}
    req = netlog_requested()
    req_all = set().union(*req.values()) if req else None

    lines = [f'# 에셋 반영 검사 (reflect.py) — {time.strftime("%Y-%m-%d %H:%M")}', '',
             f'정본 `saga-assets/` 에셋 파일 {len(files)}개 · 범주 {len(cats)} · 흔한 이름이라 판정 불가 {sum(ambiguous(f) for f in files)} · 트랙 코드 토큰: ' +
             ' · '.join(f'{c} 느슨 {len(L[c])}/엄격 {len(S[c])}' for c in cols), '']
    unused_loose, unused_strict, unreq = [], [], []
    rows = []
    for c in sorted(cats):
        fs = cats[c]
        n = len(fs)
        row = {'cat': c, 'n': n, 'amb': sum(ambiguous(f) for f in fs)}
        fs = [f for f in fs if not ambiguous(f)]   # 흔한 이름은 셈에서 뺀다(따로 '판정 불가' 열)
        for col in cols:
            row[col + '_l'] = sum(hit(f, L[col]) for f in fs)
            row[col + '_s'] = sum(hit(f, S[col]) for f in fs)
        any_l = [f for f in fs if not any(hit(f, L[col]) for col in cols)]
        any_s = [f for f in fs if not any(hit(f, S[col]) for col in cols)]
        row['any_l'] = len(fs) - len(any_l)
        row['any_s'] = len(fs) - len(any_s)
        unused_loose += any_l
        unused_strict += any_s
        if req_all is not None:
            row['req'] = sum(any(k in req_all for k in keys_of(f)) for f in fs)
            unreq += [f for f in fs if row['web_l'] and not any(k in req_all for k in keys_of(f))]
        rows.append(row)

    def table(key, title):
        out = [f'## {title}', '', '| 범주 | 파일 | 판정 불가(흔한 이름) | 웹 | 고돗 | 유니티 | 어느 트랙이든 |', '|---|---:|---:|---:|---:|---:|---:|']
        for r in rows:
            out.append(f"| {r['cat']} | {r['n']} | {r['amb']} | {r['web_' + key]} | {r['godot_' + key]} | {r['unity_' + key]} | {r['any_' + key]} |")
        tot = sum(r['n'] for r in rows)
        out.append(f"| **합** | {tot} | {sum(r['amb'] for r in rows)} | {sum(r['web_' + key] for r in rows)} | {sum(r['godot_' + key] for r in rows)} | "
                   f"{sum(r['unity_' + key] for r in rows)} | {sum(r['any_' + key] for r in rows)} |")
        return out + ['']
    lines += table('l', '느슨 — 이름 표·복사본 포함')
    lines += table('s', '엄격 — 그리는 코드만(이름 표 제외)')
    if req_all is not None:
        lines += ['## 요청 — 헤드리스 데모 장면에서 실제 요청된 수(웹, net-log.mjs)', '',
                  '| 범주 | 파일 | 웹 코드(느슨) | 요청됨 |', '|---|---:|---:|---:|']
        for r in rows:
            lines.append(f"| {r['cat']} | {r['n']} | {r['web_l']} | {r['req']} |")
        lines += ['', f'판별 요청 파일 수: ' + ' · '.join(f'{g} {len(s)}' for g, s in sorted(req.items())), '',
                  f'### 웹 코드엔 이름이 있으나 데모 다섯 장면에서 한 번도 요청 안 됨 ({len(unreq)})', '']
        lines += [f'- {f}' for f in unreq[:400]] + ([f'- … {len(unreq) - 400} 더'] if len(unreq) > 400 else []) + ['']
    lines += [f'## 어느 트랙에서도 이름이 안 나옴 — 느슨 ({len(unused_loose)})', '']
    lines += [f'- {f}' for f in unused_loose[:400]] + ([f'- … {len(unused_loose) - 400} 더'] if len(unused_loose) > 400 else []) + ['']
    by = defaultdict(int)
    for f in unused_strict:
        by[cat_of(f)] += 1
    lines += [f'## 엄격 기준 안 쓰임 — 범주별 수 ({len(unused_strict)})', '']
    lines += [f'- {c}: {n}' for c, n in sorted(by.items(), key=lambda x: -x[1])] + ['']
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'reflect.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print(f'보고 {rel(os.path.join(OUT, "reflect.md"))} · {time.time() - t0:.0f}초')
    for r in rows:
        print(f"{r['cat']:28} {r['n']:5} 불가 {r['amb']:4}  느슨 web {r['web_l']:5} godot {r['godot_l']:5} unity {r['unity_l']:5} | 엄격 any {r['any_s']:5}"
              + (f" | 요청 {r['req']}" if 'req' in r else ''))
    amb_n = sum(r['amb'] for r in rows)
    print(f'REFLECT loose-unused {len(unused_loose)}/{len(files)} strict-unused {len(unused_strict)}/{len(files)} ambiguous {amb_n}'
          + (f' unrequested {len(unreq)}' if req_all is not None else ''))
    return 0


def quick(args):
    """정본 범주 이름(폴더)이 어느 트랙 코드에도 안 나오면 WARN — precheck 한 줄용(수 초)."""
    cat_of = categories()
    cats = sorted({cat_of(f) for f in canon_files()})
    trs = tracks({'web', 'godot', 'unity'}, None)
    text = []
    for t in trs:
        for d in t['code_dirs']:
            for p in walk(d, skip=t['code_skip'] | {'node_modules', 'Library', 'Temp', 'Logs', 'obj'}):
                if os.path.splitext(p)[1].lower() in t['code_ext'] and os.path.getsize(p) < 8 << 20 \
                        and not os.path.normpath(p).startswith(os.path.normpath(t['asset_dir']) + os.sep):
                    text.append(read(p))
    blob = '\n'.join(text)
    names = defaultdict(set)   # 범주 → 대조할 이름들(범주 폴더 이름 + 배치 대상 폴더 끝 이름)
    try:
        for it in json.load(open(MANIFEST, encoding='utf-8'))['items']:
            c = it['src'].replace('\\', '/')[len('saga-assets/'):].rstrip('/')
            for t in it.get('targets', []):
                names[c].add(os.path.basename(t['dir'].rstrip('/')))
    except (OSError, KeyError, ValueError):
        pass
    for c in cats:
        names[c].add(c.split('/')[-1])
        names[c].add(c)
    warn = [c for c in cats if not any(n and n in blob for n in names[c])]
    if warn:
        print('WARN 정본 범주가 어느 트랙 코드에도 안 나옴(배선 티켓 후보): ' + ', '.join(warn))
    else:
        print(f'ok   정본 범주 {len(cats)}개 전부 어느 트랙 코드엔 이름이 나온다')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--categories', action='store_true', help='빠른 판: 범주 이름만(precheck)')
    a = ap.parse_args()
    sys.exit(quick(a) if a.categories else run(a))


if __name__ == '__main__':
    main()
