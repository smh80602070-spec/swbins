"""K-0112 한 장 대역 후보 세트 고르기 — gen.py --variants N 이 만든 <풀>_<방향>_vNN.png 를 **세트(같은 vNN = 같은 씨앗)** 로 묶는다.

  py tools/ai-art/pick_moving2d_sets.py stage <생성폴더> <세트폴더>          # <풀>-vNN_<방향>.png 로 복사 → pack_moving2d.py <세트폴더> <포장> --heads 로 세트마다 등신·시트
  py tools/ai-art/pick_moving2d_sets.py pick  <생성폴더> <고름폴더> <풀>=<NN>[,<방향>:<NN>..] ...
        예) hero_m=2  rts_inf_ally=3,back:1   → <고름폴더>/<풀>_<방향>.png(+license) — pack_moving2d.py 의 원본 폴더 꼴
같은 풀 세 방향은 같은 vNN 을 기본으로 한다(옷·색이 덜 어긋난다). 방향마다 다른 후보는 눈으로 같은 사람인지 본 뒤에만.
"""
import os
import re
import shutil
import sys

PAT = re.compile(r'^(.+)_(front|side|back)_v(\d\d)\.png$')


def files(src):
    for f in sorted(os.listdir(src)):
        m = PAT.match(f)
        if m:
            yield f, m.group(1), m.group(2), m.group(3)


def copy(src, f, dst, name):
    shutil.copyfile(os.path.join(src, f), os.path.join(dst, name + '.png'))
    lp = os.path.join(src, f[:-4] + '.license.json')
    if os.path.exists(lp):
        shutil.copyfile(lp, os.path.join(dst, name + '.license.json'))


def stage(src, dst):
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f, pool, v, k in files(src):
        copy(src, f, dst, f'{pool}-v{k}_{v}')
        n += 1
    print('세트 후보', n, '장 →', dst)


def pick(src, dst, specs):
    os.makedirs(dst, exist_ok=True)
    have = {(p, v, k): f for f, p, v, k in files(src)}
    n = 0
    for s in specs:
        pool, _, rest = s.partition('=')
        parts = rest.split(',')
        base = parts[0].zfill(2)
        over = dict(x.split(':') for x in parts[1:])
        for v in ('front', 'side', 'back'):
            k = over.get(v, base).zfill(2)
            f = have.get((pool, v, k))
            if not f:
                sys.exit(f'없음 {pool}_{v}_v{k}')
            copy(src, f, dst, f'{pool}_{v}')
            n += 1
    print('고름', n, '장 →', dst)


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == 'stage':
        stage(a[1], a[2])
    elif len(a) >= 4 and a[0] == 'pick':
        pick(a[1], a[2], a[3:])
    else:
        sys.exit(__doc__)
