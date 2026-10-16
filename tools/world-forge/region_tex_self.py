"""K-0113 지역 바닥 재질(saga-assets/regions/<지역>/tex/*.jpg) — 자체 PBR 바탕색에서 다시 만든다(옛: Poly Haven diff 2k → 1024px, 채도 +18%).

  py tools/world-forge/region_tex_self.py        # make_self_src.py 다음. 옛 license 의 source 에서 재질 id 를 읽어 _src/self/<id>_diff.png 로 같은 처리
"""
import glob
import json
import os
import re

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SELF = os.path.join(HERE, '_src', 'self')
idx = json.load(open(os.path.join(SELF, 'index.json'), encoding='utf-8'))
n = 0
for lp in sorted(glob.glob(os.path.join(ROOT, 'saga-assets', 'regions', '*', 'tex', '*.license.json'))):
    lic = json.load(open(lp, encoding='utf-8'))
    m = re.search(r'(?:Poly Haven|self-pbr:?) ([a-z0-9_]+)', lic.get('source', ''))
    tid = m.group(1) if m else lic.get('material_id')
    if tid not in idx:
        print('모름', lp, lic.get('source'))
        continue
    im = Image.open(os.path.join(SELF, idx[tid]['diff'])).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    a = np.clip(lum + (a - lum) * 1.18, 0, 1)
    jpg = lp[:-len('.license.json')] + '.jpg'
    Image.fromarray((a * 255).astype(np.uint8)).save(jpg, quality=90)
    lic.update(source=f'self-pbr {tid} → 세트 {idx[tid]["set"]} (자체 PBR 1024px, 채도 +18%)', material_id=tid,
               license='자체 생성 — Z-Image-Turbo(Apache-2.0) 견본 → pbr_from_albedo.py (K-0093·K-0113), 남의 사진 0')
    json.dump(lic, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n += 1
print('REGION_TEX_OK', n)
