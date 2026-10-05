"""얼굴 레이어 일괄(K-0072 단계 3) — 확정 20명(data/vrm_mix_pick20.json)마다 얼굴 레이어 조합 후보 3개를 굽고, 머리를 CPU 로 렌더한다.
고르기는 판정기(`judge.sh score <render> --spec portrait --per-group 1` → pick) — 사람이 고르지 않는다.

  py tools/char-forge/face_layers_batch.py plan     # data/face_layers_plan.json (씨앗 = id, 같은 몸·머리 묶음끼리 피부·눈동자가 겹치지 않게)
  py tools/char-forge/face_layers_batch.py build    # _out/face_mix/<id>_v<n>.glb (있으면 건너뜀 = 멱등)
  py tools/char-forge/face_layers_batch.py render   # _out/face_mix/render/<id>_v<n>.png (CPU Cycles — GPU 작업과 겹쳐도 된다)
"""
import json
import os
import random
import shutil
import subprocess
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from vrm_mix_batch import VRM, SRC, BLENDER, blender  # noqa: E402

PICK = os.path.join(HERE, 'data', 'vrm_mix_pick20.json')
PLAN = os.path.join(HERE, 'data', 'face_layers_plan.json')
MIX = os.path.join(HERE, '_out', 'vrm_mix')
OUT = os.path.join(HERE, '_out', 'face_mix')
N = 3                                        # 사람마다 후보 수
RANGE = {'eye': 4, 'brow': 3, 'mouth': 3, 'iris': 9, 'skin': 5, 'deco': 4}


def make_plan():
    people = json.load(open(PICK, encoding='utf-8'))['rows']
    taken = {}                               # 몸·머리 묶음 → 이미 쓴 (피부, 눈동자) — 비율만 다른 쌍이 같은 사람으로 보이지 않게
    rows = []
    for p in people:
        rng = random.Random(zlib.crc32(p['id'].encode()))
        used = taken.setdefault(p['group'], set())
        for v in range(1, N + 1):
            for _ in range(200):
                c = {k: rng.randrange(n) for k, n in RANGE.items()}
                c['skin'] = rng.randrange(1, 5) if rng.random() < 0.8 else 0      # 대부분 피부를 바꾼다(가장 크게 보이는 축)
                c['iris'] = rng.randrange(1, 9)
                if (c['skin'], c['iris']) not in used:
                    break
            used.add((c['skin'], c['iris']))
            rows.append({'id': f"{p['id'].replace('vmix_', 'vface_')}_v{v}", 'src': p['id'], 'body': p['body'], 'spec': c})
    json.dump({'note': 'K-0072 단계 3 — 얼굴 레이어 후보(사람마다 3). 얼굴은 만들지 않는다(샘플 표정 섞기·텍스처 색·코드 장식).', 'rows': rows},
              open(PLAN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rows


def load_plan():
    return json.load(open(PLAN, encoding='utf-8'))['rows'] if os.path.exists(PLAN) else make_plan()


def build(rows):
    os.makedirs(OUT, exist_ok=True)
    ok = fail = 0
    for r in rows:
        dst = os.path.join(OUT, r['id'] + '.glb')
        if os.path.exists(dst):
            continue
        spec = ','.join(f'{k}={v}' for k, v in r['spec'].items())
        code, out = blender(['-P', os.path.join(HERE, 'face_layers.py'), '--', os.path.join(MIX, r['src'] + '.glb'),
                             os.path.join(SRC, VRM[r['body']]), dst, spec])
        good = 'FACE_OK' in out and os.path.exists(dst)
        ok += good
        fail += not good
        if not good:
            open(os.path.join(OUT, r['id'] + '.fail.txt'), 'w', encoding='utf-8').write(out[-3000:])
        print(r['id'], 'OK' if good else 'FAIL', flush=True)
    print(f'BUILD ok={ok} fail={fail}')
    return fail == 0


def render(rows):
    rd = os.path.join(OUT, 'render')
    os.makedirs(rd, exist_ok=True)
    todo = [os.path.join(OUT, r['id'] + '.glb') for r in rows
            if os.path.exists(os.path.join(OUT, r['id'] + '.glb')) and not os.path.exists(os.path.join(rd, r['id'] + '.png'))]
    for i in range(0, len(todo), 12):
        blender(['-P', os.path.join(HERE, 'render', 'render_heads_cpu.py'), '--', rd] + todo[i:i + 12])
    for f in os.listdir(rd):
        if f.endswith('_hc.png'):
            shutil.move(os.path.join(rd, f), os.path.join(rd, f[:-7] + '.png'))
    print('RENDER_DONE', len(todo))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    rows = make_plan() if cmd == 'plan' else load_plan()
    if cmd == 'plan':
        print('PLAN', len(rows))
    elif cmd == 'build':
        sys.exit(0 if build(rows) else 1)
    elif cmd == 'render':
        render(rows)
