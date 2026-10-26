"""K-0201 ① 고르기·적용 — k201_trial.sh 결과(base_w·trial_w)를 사람마다 비교해 먼 팔·smear 를 받을 사람을 고른다.
  py tools/ai-art/k188/k201_apply.py            # 표만
  py tools/ai-art/k188/k201_apply.py --apply    # 받는 사람 setj far copyall·fill smear → 다시 자름(rig·preview) + --also 의 사람도 다시 자름 → PICKED 목록(publish 는 따로)
받는 기준 = 시험 ≤ 기준 × 1.3 + 5(먼 팔은 그 자체로 바라는 것 — 조금 느는 건 받음). 못 받은 사람은 목록 끝(손 몫).
"""
import collections
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
T = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k199')
cnt = lambda f: collections.Counter(x['id'] for x in json.load(open(os.path.join(T, f), encoding='utf-8')))
base, tri = cnt('base_w.json'), cnt('trial_w.json')
ids = sorted(os.listdir(os.path.join(T, 'trialW')))
take, keep = [], []
for i in ids:
    (take if tri[i] <= base[i] * 1.3 + 5 else keep).append(i)
print('받음', len(take), '· 합', sum(base[i] for i in take), '→', sum(tri[i] for i in take))
print('그대로', len(keep), [(i, base[i], tri[i]) for i in keep])
if '--apply' in sys.argv:
    also = sys.argv[sys.argv.index('--also') + 1].split(',') if '--also' in sys.argv else []
    for i in take:
        subprocess.run(['py', 'tools/ai-art/k188/setj.py', i, '{"far":"copyall","fill":"smear"}'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    todo = sorted(set(take) | set(also))
    for i in todo:
        D = f'tools/ai-art/_out/k188/p/{i}'
        subprocess.run(['py', 'tools/ai-art/k188_cutout.py', 'cut', D + '/side.png', D + '/joints.json', D + '/rig', '--fill', 'sd'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['py', 'tools/ai-art/k188_cutout.py', 'preview', D + '/rig', D + '/prev', '--h', '360'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    print('PICKED', ','.join(todo))
