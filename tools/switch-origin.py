# -*- coding: utf-8 -*-
"""저장소·공개 주소 계정 전환 — 옛 계정(smh8627-jpg) 정지 중에는 새 계정(smh80602070-spec)으로, 정지가 풀리면 되돌린다.

    py tools/switch-origin.py status   # 지금 어느 쪽인지(git origin · 글 속 주소 수)
    py tools/switch-origin.py new      # 정지 중 임시 — origin·글 속 주소를 새 계정으로
    py tools/switch-origin.py old      # 정지가 풀리면 — 원래 계정으로 되돌림
    py tools/switch-origin.py old --dry   # 바꿀 파일만 보여 준다

하는 일
  1) git 원격: origin = 고른 계정 저장소, alt-origin = 다른 쪽(둘 다 남긴다). main 추적 = origin/main.
     새 계정 주소에는 사용자 이름을 넣는다(정지된 옛 계정의 저장된 로그인과 섞이지 않게).
  2) 추적 중인 글 파일 속 주소: `<계정>.github.io` · `github.com/<계정>/swbins`(swbins4 는 그대로 — 별도 저장소는 옛 계정에만 있다).
     기록(archive/·*/done/·*HISTORY*)과 이 파일은 손대지 않는다. 줄바꿈(CRLF/LF)은 그대로 둔다.
되돌린 뒤: 옛 저장소는 정지 동안 쌓인 커밋이 없으니 `bash tools/push.sh` 로 올린다(한 번에 2GB 가 넘으면 나눠서 —
  새 계정 첫 푸시 때처럼 `git rev-list --reverse --first-parent HEAD` 300개씩). 커밋은 `git commit -F … -- <바뀐 파일>`.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ACC = {'old': 'smh8627-jpg', 'new': 'smh80602070-spec'}
REMOTE = {'old': 'https://github.com/smh8627-jpg/swbins.git',
          'new': 'https://smh80602070-spec@github.com/smh80602070-spec/swbins.git'}
SKIP = (re.compile(r'^archive/'), re.compile(r'/done/'), re.compile(r'HISTORY'), re.compile(r'^tools/switch-origin\.py$'))


def git(*a, check=True):
    return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=check).stdout


def rules(src, dst):
    s, d = re.escape(src), dst
    return [(re.compile(rf'{s}@github\.com/{s}/swbins(?!4)'), f'{d}@github.com/{d}/swbins'),
            (re.compile(rf'github\.com/{s}/swbins(?!4)'), f'github.com/{d}/swbins'),
            (re.compile(rf'{s}\.github\.io'), f'{d}.github.io')]


def files():
    for p in git('ls-files').splitlines():
        if any(r.search(p) for r in SKIP):
            continue
        fp = os.path.join(ROOT, p)
        if os.path.isfile(fp) and os.path.getsize(fp) < 4_000_000:
            yield p, fp


def count(acc):
    pat = rules(acc, 'x')
    n = 0
    for p, fp in files():
        try:
            t = open(fp, 'rb').read().decode('utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        n += sum(len(r.findall(t)) for r, _ in pat)
    return n


def status():
    url = git('remote', 'get-url', 'origin', check=False).strip()
    side = 'new' if ACC['new'] in url else 'old' if ACC['old'] in url else '?'
    print(f'origin = {url}  ({side})')
    print(f'글 속 주소 — 옛 계정 {count(ACC["old"])}곳 · 새 계정 {count(ACC["new"])}곳')
    return side


def switch(to, dry=False):
    frm = 'old' if to == 'new' else 'new'
    pat = rules(ACC[frm], ACC[to])
    changed = []
    for p, fp in files():
        raw = open(fp, 'rb').read()
        try:
            t = raw.decode('utf-8')
        except UnicodeDecodeError:
            continue
        u = t
        for r, rep in pat:
            u = r.sub(rep, u)
        if u != t:
            changed.append(p)
            if not dry:
                with open(fp, 'wb') as f:                                  # 읽은 뒤 쓴다(덮어쓰기 전에 내용 확보) · 줄바꿈 그대로
                    f.write(u.encode('utf-8'))
    print(('바꿀' if dry else '바꾼') + f' 파일 {len(changed)}개')
    for p in changed:
        print('  ' + p)
    if dry:
        return
    names = git('remote').split()
    if 'old-origin' in names and 'alt-origin' not in names:
        git('remote', 'rename', 'old-origin', 'alt-origin')
        names = git('remote').split()
    if 'alt-origin' not in names:
        git('remote', 'add', 'alt-origin', REMOTE[frm])
    git('remote', 'set-url', 'alt-origin', REMOTE[frm])
    git('remote', 'set-url', 'origin', REMOTE[to])
    print(f'origin → {REMOTE[to]}\nalt-origin → {REMOTE[frm]}')
    if git('ls-remote', 'origin', 'refs/heads/main', check=False).strip():
        git('fetch', '-q', 'origin', check=False)
        git('branch', '-u', 'origin/main', 'main', check=False)
        print('main 추적 = origin/main')
    print('다음: 바뀐 파일을 커밋(git commit -F … -- <파일>) 후 bash tools/push.sh')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'status':
        status()
    elif a[0] in ('new', 'old'):
        switch(a[0], dry='--dry' in a)
    else:
        print(__doc__)
