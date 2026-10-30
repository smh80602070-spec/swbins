"""K-0207 ② 인물별 팔 부위 폭(`w.arm`) 자동 조정 — 폭 ×1.0·0.85·0.7·0.55 로 다시 잘라 공격·달리기·걷기 떨어짐(detach_check 식)이 가장 적은 폭을 고른다.
  py tools/ai-art/k198_arm_tune.py <id>:<front|back> …      (_out/k198/<id>_<view>/ 의 joints.json·front.png|back.png 를 쓴다)
고르면 그 폭으로 joints.json 을 고치고 rig 를 다시 자른다. 기준 = 서기(idle) 떨어짐보다 늘어난 것만 센다."""
import json
import os
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import k188_cutout as K  # noqa: E402

ROOT = K.ROOT
OUT = os.path.join(HERE, '_out', 'k198')
CLIPS = ['attack', 'run', 'walk']
SCALES = (1.0, 0.85, 0.7, 0.55)
TH, H, NP = 0.004, 160, 6


def cut(d, img, scale, w0):
    jp = os.path.join(d, 'joints.json')
    j = json.load(open(jp, encoding='utf-8')); j['w']['arm'] = round(w0 * scale, 1)
    json.dump(j, open(jp, 'w'))
    K.cut(os.path.join(d, img), jp, os.path.join(d, 'rig'), far='copy', fill='smear')


def detach_score(rigdir, pack, robe):
    tmp = tempfile.mkdtemp()
    for f in os.listdir(rigdir):
        if f.endswith('.webp'):
            shutil.copy(os.path.join(rigdir, f), tmp)
    rig = json.load(open(os.path.join(rigdir, 'rig.json'), encoding='utf-8'))
    names = CLIPS + ['idle']
    rig['clips'] = {k: (pack.get(k + '~robe', pack[k]) if robe else pack[k]) for k in names}
    json.dump(rig, open(os.path.join(tmp, 'rig.json'), 'w'))

    def offs(nm, ph):
        a = np.asarray(K.render(tmp, nm, ph, H))[..., 3] > 40
        lab, k = ndimage.label(a)
        if k < 2:
            return [], 1.0
        area = ndimage.sum(a, lab, range(1, k + 1)); main = area.max()
        return [float(x) for x in area if x != main and x > main * TH], main
    b0, m0 = offs('idle', 0.0); bn, bs = len(b0), sum(b0) / m0
    n = 0
    for nm in CLIPS:
        for i in range(NP):
            ph = i / NP if rig['clips'][nm].get('loop') else i / max(1, NP - 1)
            off, main = offs(nm, ph)
            if off and not (len(off) <= bn and sum(off) / main <= bs * 1.5 + TH):
                n += 1
    shutil.rmtree(tmp, ignore_errors=True)
    return n


def main():
    for arg in sys.argv[1:]:
        i, view = arg.split(':')
        d = os.path.join(OUT, f'{i}_{view}'); img = 'front.png' if view == 'front' else 'back.png'
        pack = json.load(open(os.path.join(ROOT, 'saga-assets', 'web2d', 'cutout', '_clips', view + '.json'), encoding='utf-8'))
        j0 = json.load(open(os.path.join(d, 'joints.json'), encoding='utf-8')); w0 = j0.get('w0', j0['w']['arm']); j0['w0'] = w0
        json.dump(j0, open(os.path.join(d, 'joints.json'), 'w'))
        robe = False
        res = []
        for s in SCALES:
            cut(d, img, s, w0)
            rig = json.load(open(os.path.join(d, 'rig', 'rig.json'), encoding='utf-8'))
            robe = bool(rig.get('clips'))
            res.append((detach_score(os.path.join(d, 'rig'), pack, robe), -s, s))
        best = min(res)
        cut(d, img, best[2], w0)
        print('ARM_TUNE', i, view, {r[2]: r[0] for r in res}, '→ 폭', best[2], flush=True)


if __name__ == '__main__':
    main()
