"""K-0113 world-forge 재질 = 자체 PBR — Poly Haven 사진(fetch_sources.py) 대신.

  py tools/world-forge/make_self_src.py            # _src/self/ 를 만든다(자체 PBR PNG + id 별 바탕색 + index.json)
  py tools/world-forge/make_self_src.py --toon-only    # 툰 GLB 만 굽는 PC(원본 생성 그림 없음) — 정본 textures_real 바탕색으로(법선·거칠기 없음)
  py tools/world-forge/make_self_src.py --gain     # 옛 사진(_src/polyhaven)이 있을 때만: id 별 색 배율을 다시 재서 self_sources.json 에 박는다

`self_sources.json` items = {재질 id(빌더가 쓰는 옛 이름 그대로): {"set": 자체 세트, "gain": [r, g, b]}}.
자체 세트 = saga-assets/textures_real/<세트>/ (K-0093·K-0113, Z-Image 생성 → pbr_from_albedo.py). 남의 사진 0.
바탕색 = 세트 hi 그림 × gain(옛 사진 평균색 ÷ 세트 평균색 — 빌더의 tint 들이 옛 색을 기준으로 맞춰져 있어서). 법선·거칠기는 세트 것 그대로.
`_src/` 는 gitignore — 다른 PC 는 이 스크립트만 다시 돌리면 된다(옛 사진 불필요, gain 은 표에 있다).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_src', 'self')
PNG = os.path.join(OUT, '_png')        # pbr_from_albedo --png 결과(<세트>/<세트>_hi{,_n,_r,_h}.png)
OLD = os.path.join(HERE, '_src', 'polyhaven')
TABLE = os.path.join(HERE, 'self_sources.json')


def mean_rgb(p):
    im = Image.open(p).convert('RGB')
    im.thumbnail((256, 256))
    return np.asarray(im, np.float32).reshape(-1, 3).mean(axis=0)


def main():
    tab = json.load(open(TABLE, encoding='utf-8'))
    items = tab['items']
    sets = sorted({v['set'] for v in items.values()})
    missing = [s for s in sets if not os.path.exists(os.path.join(PNG, s, f'{s}_hi.png'))]
    if '--toon-only' in sys.argv:   # K-0208 — 툰은 바탕색 한 장만 쓴다: 원본 생성 그림(_out/k93_pbr, 그 PC 로컬) 없이 정본 textures_real/<세트>/<세트>_color.png 로 만든다(법선·거칠기 없음 → real 스타일 불가)
        canon = os.path.join(ROOT, 'saga-assets', 'textures_real')
        os.makedirs(OUT, exist_ok=True)
        idx = {}
        for tid, v in items.items():
            sset, g = v['set'], np.array(v.get('gain', [1, 1, 1]), np.float32)
            px = np.asarray(Image.open(os.path.join(canon, sset, f'{sset}_color.png')).convert('RGB'), np.float32) * g
            Image.fromarray(np.clip(px, 0, 255).astype(np.uint8)).save(os.path.join(OUT, f'{tid}_diff.png'))
            idx[tid] = {'diff': f'{tid}_diff.png', 'set': sset}
        json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'SELF_SRC_OK(toon-only) {len(idx)} id → {OUT}')
        return
    if missing:
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'ai-art', 'pbr_from_albedo.py'), '--sets', ','.join(sets), '--png', PNG], cwd=ROOT)
        if r.returncode:
            sys.exit('pbr_from_albedo --png 실패')
    if '--gain' in sys.argv:
        old = json.load(open(os.path.join(OLD, 'index.json'), encoding='utf-8'))
        for tid, v in items.items():
            o = mean_rgb(os.path.join(OLD, old[tid]['diff']))
            s = mean_rgb(os.path.join(PNG, v['set'], f"{v['set']}_hi.png"))
            v['gain'] = [round(float(x), 3) for x in np.clip(o / np.maximum(s, 1), 0.25, 3.0)]
        json.dump(tab, open(TABLE, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
        print('gain 다시 잼', len(items))
    os.makedirs(OUT, exist_ok=True)
    idx = {}
    for tid, v in items.items():
        s, g = v['set'], np.array(v.get('gain', [1, 1, 1]), np.float32)
        base = os.path.join(PNG, s, f'{s}_hi')
        px = np.asarray(Image.open(base + '.png').convert('RGB'), np.float32) * g
        Image.fromarray(np.clip(px, 0, 255).astype(np.uint8)).save(os.path.join(OUT, f'{tid}_diff.png'))
        idx[tid] = {'diff': f'{tid}_diff.png', 'nor': f'_png/{s}/{s}_hi_n.png', 'rough': f'_png/{s}/{s}_hi_r.png', 'set': s}
    json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'SELF_SRC_OK {len(idx)} id · 세트 {len(sets)} → {OUT}')


if __name__ == '__main__':
    main()
