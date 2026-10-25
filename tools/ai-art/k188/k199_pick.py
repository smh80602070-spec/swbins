"""K-0199 떨어짐 시험 고르기 — k199_trial.sh 결과(trial_A·trial_B)와 정본 기준(detach_all_base.json)을 사람마다 비교.
  py tools/ai-art/k188/k199_pick.py            # 표만
  py tools/ai-art/k188/k199_pick.py --apply    # B 가 이긴 사람은 skirt_cut 켬(setj) → 다시 자름(rig) → 고른 목록 출력(publish 는 따로)
이기는 기준 = 기준보다 5% 넘게 적음. A·B 둘 다 못 이기면 그대로(지금 규칙이 나빠진 사람은 목록 끝에 — 손 관절 몫).
"""
import collections
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
T = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k199')
cnt = lambda f: collections.Counter(x['id'] for x in json.load(open(os.path.join(T, f), encoding='utf-8')))
base, A, B = cnt('detach_all_base.json'), cnt('trial_A.json'), cnt('trial_B.json')
idsA = set(os.listdir(os.path.join(T, 'trialA')))
idsB = set(os.listdir(os.path.join(T, 'trialB'))) if os.path.isdir(os.path.join(T, 'trialB')) else set()
rows, worse = [], []
for i in sorted(idsA):
    b, a = base[i], A[i]
    bb = B[i] if i in idsB else None
    best = min([('base', b), ('A', a)] + ([('B', bb)] if bb is not None else []), key=lambda x: x[1])
    if best[0] != 'base' and best[1] > b * 0.95:
        best = ('base', b)
    rows.append((i, b, a, bb, best[0]))
    if a > b * 1.05 and best[0] == 'base':
        worse.append(i)
tot = lambda k: sum({'base': r[1], 'A': r[2], 'B': r[3] if r[3] is not None else r[2]}[r[4]] for r in rows)
print('id base A B pick')
for r in rows:
    if r[4] != 'base' or r[0] in worse:
        print(*r)
print('합 base', sum(base[i] for i in idsA), '→ 고른 것', tot(None), '· A', sum(1 for r in rows if r[4] == 'A'), '· B', sum(1 for r in rows if r[4] == 'B'), '· 나빠진 것', worse)
if '--apply' in sys.argv:
    picked = [r[0] for r in rows if r[4] in ('A', 'B')]
    for i, *_, p in rows:
        if p not in ('A', 'B'):
            continue
        if p == 'B':
            subprocess.run(['py', 'tools/ai-art/k188/setj.py', i, '{"skirt_cut":1}'], cwd=ROOT, check=True)
        D = f'tools/ai-art/_out/k188/p/{i}'
        subprocess.run(['py', 'tools/ai-art/k188_cutout.py', 'cut', D + '/side.png', D + '/joints.json', D + '/rig', '--fill', 'sd'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['py', 'tools/ai-art/k188_cutout.py', 'preview', D + '/rig', D + '/prev', '--h', '360'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    print('PICKED', ','.join(picked))
