"""자체 산출물 사본의 출처 절 자동 생성 (K-0119) — 다섯 판 `assets/ASSET_LICENSES.md` 끝 표시 구간만 다시 쓴다.

    py -3 tools/asset-audit/self_docs.py           # 다섯 판 문서의 자동 구간을 다시 쓴다
    py -3 tools/asset-audit/self_docs.py --check   # 쓰지 않고 지금 계산과 같은지만(다르면 종료 코드 1)

규칙: 판 `assets/` 의 파일(GLB 포함 전부) 중 md5 가 `saga-assets/` 정본 파일과 같은 것 = 자체 산출 사본.
폴더 안 파일이 **전부** 정본 사본이면 `` `<폴더>/*` `` 한 줄(audit.py 가 와일드카드로 인정), 아니면 그 파일 이름만 적는다.
도구·모델·라이선스는 정본 옆 `*.license.json`(이름에서 `_a`·`_k`·`_c`·`_s` 꼬리를 떼어 찾고, 없으면 `<폴더>/license/`)에서 모은다.
손으로 쓴 절은 건드리지 않는다 — 표시 줄 사이만.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']
BEGIN = '<!-- self-made:auto (tools/asset-audit/self_docs.py, K-0119) — 손으로 고치지 말 것 -->'
END = '<!-- /self-made:auto -->'
SELF_MADE = ['/generated/', '/portraits/']   # audit.py 와 같음 — 점검이 원래 빼는 우리 도구 산출 폴더
TAIL = re.compile(r'_(a|k|c|s|n|r|hi|lo)$')


def md5(p):
    h = hashlib.md5()
    with open(os.path.join(ROOT, p), 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def lic_of(canon, S):
    d, fn = os.path.split(canon)
    stem = os.path.splitext(fn)[0]
    tries = [stem, TAIL.sub('', stem), re.sub(r'(_\d+)?_(a|k)$', '', stem), re.sub(r'_g\d+$', '', stem)]
    for s in tries:
        for c in (f'{d}/{s}.license.json', f'{d}/license/{s}.license.json', f'{os.path.dirname(d)}/license/{s}.license.json'):
            if c in S:
                try:
                    return json.load(open(os.path.join(ROOT, c), encoding='utf-8'))
                except (OSError, ValueError):
                    return None
    man = f'{d}/manifest.json'   # 2D 대역 시트 등 — 폴더 manifest 의 license·generator
    if man in S:
        try:
            j = json.load(open(os.path.join(ROOT, man), encoding='utf-8'))
            if isinstance(j, dict) and j.get('license'):
                return j
        except (OSError, ValueError):
            pass
    return None


def partial(d, all_files, hit):
    """폴더 일부만 사본 — 꼬리(`_c.webp` 등)마다 그 꼬리 파일이 전부 사본이면 와일드카드, 아니면 이름(12개까지)"""
    tails = defaultdict(list)
    for f in all_files:
        b = os.path.basename(f)
        m = re.search(r'(_[a-z0-9]+)?\.[a-z0-9]+$', b)
        tails[m.group(0) if m else b].append(f)
    out, rest = [], []
    for t, fs in sorted(tails.items()):
        ok = [f for f in fs if f in hit]
        if not ok:
            continue
        if len(ok) == len(fs) and len(fs) > 1:
            out.append(f'`{d}/*{t}`')
        else:
            rest += [os.path.basename(f) for f in ok]
    rest.sort()
    out += [f'`{n}`' for n in rest[:12]] + ([f'외 {len(rest) - 12}'] if len(rest) > 12 else [])
    return ', '.join(out)


def summarize(lics):
    tools, lic = Counter(), Counter()
    for j in lics:
        if not j:
            continue
        g = j.get('generator') or j.get('tool') or ''
        m = j.get('model') or ''
        tools[(os.path.basename(str(g)) + (' · ' + str(m) if m else '')).strip(' ·')] += 1
        l = j.get('license') or j.get('model_license') or ''
        if l:
            lic[str(l).split(' (')[0][:60]] += 1
    t = ', '.join(k for k, _ in tools.most_common(3) if k) or '자체 도구'
    l = ', '.join(k for k, _ in lic.most_common(2)) or '정본 license.json 참조'
    return t, l


def build():
    files = subprocess.run(['git', 'ls-files', 'saga-web', 'saga-assets'], cwd=ROOT,
                           capture_output=True).stdout.decode('utf-8', 'replace').splitlines()
    S = set(files)
    canon = {}
    for f in files:
        if f.startswith('saga-assets/') and not f.endswith(('.license.json', '.md')):
            canon.setdefault(md5(f), f)
    out = {}
    for g in GAMES:
        pre = f'saga-web/{g}/assets/'
        bydir = defaultdict(list)
        for f in files:
            if f.startswith(pre) and not f.endswith(('.license.json', '.md')):
                bydir[os.path.dirname(f[len(pre):])].append(f)
        lines = []
        for d in sorted(bydir):
            if any(m in '/' + d + '/' for m in SELF_MADE):
                continue
            hit = [(f, canon.get(md5(f))) for f in bydir[d]]
            hit = [(f, c) for f, c in hit if c]
            if not hit:
                continue
            srcs = sorted({os.path.dirname(c) for _, c in hit})
            t, l = summarize(lic_of(c, S) for _, c in hit)
            if len(hit) == len(bydir[d]):
                what = f'`{d}/*`' if d else '`*`'
            else:
                what = partial(d, bydir[d], {f for f, _ in hit})
            lines.append(f'| {what} | {len(hit)} | {", ".join("`" + s + "`" for s in srcs[:3])} | {t} | {l} |')
        out[g] = lines
    return out


def block(lines):
    head = ['', BEGIN, '## 자체 산출 사본 — saga-assets 정본과 md5 같은 파일 (자동)', '',
            '이 판 `assets/` 안에서 정본(`saga-assets/`)과 내용이 같은 파일. 출처·도구·모델은 정본 옆 `*.license.json` 이 정본이고,'
            ' 묶음별 라이선스 모음은 `saga-assets/CREDITS.md`.', '',
            '| 파일 | 수 | 정본 | 도구·모델 | 라이선스 |', '|---|---|---|---|---|']
    return '\n'.join(head + lines + [END]) + '\n'


def main():
    check = '--check' in sys.argv
    data = build()
    bad = 0
    for g, lines in data.items():
        p = os.path.join(ROOT, 'saga-web', g, 'assets', 'ASSET_LICENSES.md')
        raw = open(p, 'rb').read().decode('utf-8')
        crlf = '\r\n' in raw
        txt = raw.replace('\r\n', '\n')
        if BEGIN in txt:
            i = txt.index(BEGIN)
            j = txt.index(END, i) + len(END)
            base = txt[:i].rstrip('\n') + '\n' + txt[j:].lstrip('\n')
        else:
            base = txt
        new = base.rstrip('\n') + '\n' + block(lines)
        if crlf:
            new = new.replace('\n', '\r\n')
        same = new == raw
        print(f'{g:13} 줄 {len(lines):3} {"같음" if same else ("다름" if check else "씀")}')
        if not same:
            bad += 1
            if not check:
                open(p, 'wb').write(new.encode('utf-8'))
    if check and bad:
        sys.exit(1)


if __name__ == '__main__':
    main()
