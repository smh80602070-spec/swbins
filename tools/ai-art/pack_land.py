"""K-0090 ② — 사가만리 3D 땅 견본(k90_go_land, Z-Image 평평한 견본) → 이음매 없는 1024 타일 WebP 18장.

  py tools/ai-art/pack_land.py            _out/k90_go_land/land_<종류><n>.png → saga-assets/land-go/<종류><n>.webp + .license.json + _out/k90_land_mosaic.jpg
  py tools/ai-art/pack_land.py --check    개수 18 · 1024² · 이음매(seam ≤ 3.0 · edge ≤ 1.6, pack_patterns64 와 같은 잣대) · 장당 ≤ 400KB · license 100%

이음매 = make_seamless.seamless()(4판 띠 섞기 + 조명 평탄화) — SDXL tiling 은 ComfyUI 에서 깨져 안 쓴다(10-09).
이름은 옛 `saga-web/saga-go/assets/textures/land/<종류><n>.webp`(ambientCG 사진)과 같고 놓는 곳만 `land_c/` — 웹이 경로를 바꾼다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_seamless import seamless  # noqa: E402
from pack_patterns64 import edge_ratio, seam_ratio, SEAM_MAX  # noqa: E402

GEN = os.path.join(HERE, '_out', 'k90_go_land')
CANON = os.path.join(HERE, '..', '..', 'saga-assets', 'land-go')
KINDS = ['grass', 'forest', 'mount', 'road', 'town', 'farm']
PX = 1024
MAX_KB = 400


def ok(a):
    return seam_ratio(a) <= SEAM_MAX and edge_ratio(a) <= 1.6


def save(t, p):
    for q in (88, 92, 96):
        t.save(p, 'WEBP', quality=q, method=6)
        a = np.asarray(Image.open(p).convert('RGB'))
        if ok(a) and os.path.getsize(p) <= MAX_KB * 1024:
            return q
    return q


def pack():
    os.makedirs(CANON, exist_ok=True)
    tiles = []
    for k in KINDS:
        for n in (1, 2, 3):
            name = f'{k}{n}'
            src = os.path.join(GEN, f'land_{name}.png')
            if not os.path.exists(src):
                print('없음', src)
                continue
            t = seamless(Image.open(src), PX, flatten=0.6)
            dst = os.path.join(CANON, name + '.webp')
            q = save(t, dst)
            a = np.asarray(Image.open(dst).convert('RGB'))
            lic = json.load(open(src[:-4] + '.license.json', encoding='utf-8'))
            lic.update(id=name, derived='tools/ai-art/pack_land.py — make_seamless.seamless(4판 띠 섞기, flatten 0.6) → %dpx WebP q%d' % (PX, q),
                       seam_ratio=round(seam_ratio(a), 2), edge_ratio=round(edge_ratio(a), 2), replaces='saga-web/saga-go/assets/textures/land/%s.webp (ambientCG 사진)' % name)
            json.dump(lic, open(os.path.join(CANON, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            tiles.append((name, Image.open(dst).convert('RGB')))
            print(f'{name:8s} seam {seam_ratio(a):.2f} edge {edge_ratio(a):.2f} q{q} {os.path.getsize(dst) // 1024}KB')
    # 확인용: 종류마다 2×2 반복 한 칸씩
    if tiles:
        cell = 256
        sheet = Image.new('RGB', (cell * 2 * 3, cell * 2 * len(KINDS)))
        for i, (name, im) in enumerate(tiles):
            s = im.resize((cell, cell), Image.LANCZOS)
            x0, y0 = (i % 3) * cell * 2, (i // 3) * cell * 2
            for dx in (0, cell):
                for dy in (0, cell):
                    sheet.paste(s, (x0 + dx, y0 + dy))
        sheet.save(os.path.join(HERE, '_out', 'k90_land_mosaic.jpg'), quality=85)


def check():
    bad = []
    fs = sorted(f for f in os.listdir(CANON) if f.endswith('.webp'))
    for f in fs:
        p = os.path.join(CANON, f)
        im = Image.open(p)
        a = np.asarray(im.convert('RGB'))
        if im.size != (PX, PX) or not ok(a) or os.path.getsize(p) > MAX_KB * 1024 or not os.path.exists(p[:-5] + '.license.json'):
            bad.append(f)
    print(f'LAND {len(fs)}/18 · 기준 밖 {len(bad)}', bad)
    return 0 if len(fs) == 18 and not bad else 1


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else pack())
