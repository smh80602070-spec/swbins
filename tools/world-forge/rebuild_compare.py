"""K-0113 다시 구운 세계 GLB ↔ 정본 비교·덮어쓰기.

  py tools/world-forge/rebuild_compare.py [<새 toon 폴더>=tools/world-forge/_out/k113/toon]            # 비교만
  py tools/world-forge/rebuild_compare.py [<폴더>] --write [--accept-diff]                              # 정본 saga-assets/world/toon 덮어씀(GLB + license) · DIFF 는 렌더로 본 뒤에만 받기

정본 id 마다: 새 것 있나 · 삼각형 수(±2% 넘게 다르면 DIFF) · size_m(±2cm) · nodes 같은가. 빠짐·DIFF 가 있으면 --write 는 멈춘다(--force 로 건너뛴 채 나머지만).
끝 줄 COMPARE_OK n | COMPARE_FAIL 빠짐 a · DIFF b.
"""
import glob
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CANON = os.path.join(ROOT, 'saga-assets', 'world', 'toon')
a = [x for x in sys.argv[1:] if not x.startswith('--')]
NEW = os.path.abspath(a[0]) if a else os.path.join(ROOT, 'tools', 'world-forge', '_out', 'k113', 'toon')


def lic(p):
    return json.load(open(p, encoding='utf-8'))


missing, diff, ok = [], [], []
for lp in sorted(glob.glob(os.path.join(CANON, '*.license.json'))):
    pid = os.path.basename(lp)[:-len('.license.json')]
    old = lic(lp)
    if 'world-forge' not in str(old.get('generator', '')):
        continue
    np_ = os.path.join(NEW, pid + '.license.json')
    if not os.path.exists(np_) or not os.path.exists(os.path.join(NEW, pid + '.glb')):
        missing.append(pid)
        continue
    new = lic(np_)
    why = []
    to, tn = old.get('tris') or 0, new.get('tris') or 0
    if to and abs(tn - to) > max(2, 0.02 * to):
        why.append(f'tris {to}→{tn}')
    so, sn = old.get('size_m'), new.get('size_m')
    if so and sn and any(abs(x - y) > 0.02 for x, y in zip(so, sn)):
        why.append(f'size {so}→{sn}')
    if old.get('nodes') != new.get('nodes'):
        why.append('nodes')
    if any('polyhaven' in i for i in new.get('inputs', [])):
        why.append('inputs polyhaven')
    (diff if why else ok).append((pid, why))
for pid in missing:
    print('MISSING', pid)
for pid, why in diff:
    print('DIFF', pid, '·'.join(why))
if '--write' in sys.argv:
    if '--accept-diff' in sys.argv:   # 눈으로 본 DIFF(예: 정본이 옛 코드로 구워져 틀렸던 것)도 새 것으로
        ok, diff = ok + diff, []
    if (missing or diff) and '--force' not in sys.argv:
        sys.exit(f'COMPARE_FAIL 빠짐 {len(missing)} · DIFF {len(diff)} — --write 멈춤(--force 로 OK 만 덮어씀)')
    for pid, _ in ok:
        for ext in ('.glb', '.license.json'):
            shutil.copyfile(os.path.join(NEW, pid + ext), os.path.join(CANON, pid + ext))
    print('WROTE', len(ok))
print(f'COMPARE_OK {len(ok)}' if not (missing or diff) else f'COMPARE_FAIL 빠짐 {len(missing)} · DIFF {len(diff)} · 같음 {len(ok)}')
