"""K-0093 — 우리 그림(Z-Image 사실풍 평면 견본) 한 장 → 이음매 없는 PBR 넷(바탕색·법선·거칠기·높이). 남의 사진·스캔 0.

  py tools/ai-art/pbr_from_albedo.py [--sets grass,dirt] [--sheet <png>] [--check]
    고른 견본  tools/ai-art/data/k93_picks.json {"<세트>": "<_out/k93_pbr 의 png 이름>"}
    정본       saga-assets/textures_real/<세트>/<세트>_color.png · <세트>.license.json
    고돗       saga-godot/assets/generated/tiles_real/<세트>_{hi,512}{,_n,_r,_h}.webp (q90)
    --png <폴더>  유니티용 무손실 PNG(<폴더>/<세트>/<세트>_{hi,512}{,_n,_r,_h}.png + license, K-0099) — 고돗·정본은 안 씀
    --sheet    세트마다 한 줄(바탕·법선·거칠기·높이 + 2×2 타일) 눈 판정용 · --check 쓰지 않고 이음매·크기만

이음매: 낱알 무늬(자갈·돌벽·기와·포장·판자)는 make_seamless.cutseam(경계 자르기 — 띠 섞기는 낱알을 반투명 겹침),
나머지는 seamless(4판 띠 섞기). 둘 다 큰 조명 얼룩을 걷는다(flatten — 반복하면 얼룩이 격자로 보인다).
hi = 이음매 처리한 그대로(띠 섞기 1024 · 경계 자르기 ≈ 910 — 늘려 붙이지 않는다) · 512 = 감싸 줄이기.
맵(세트별 손잡이는 아래 SETS 한 표):
  높이   = 밝기 고역(감싼 가우스 빼기, 반경 size/24) → 0~1 · invert 면 뒤집음(밝은 게 홈인 재질)
  법선   = 높이 기울기(np.roll 로 감싸 이음매 유지) × strength, OpenGL Y+(초록 = 위)
  거칠기 = base + var × 2 × (0.5 − 높이) → base ± var(홈이 더 거칠다), 0.05~1
검사: pack_patterns64 잣대 — seam_ratio ≤ 3.0 · edge_ratio ≤ 1.6 (바탕색 hi).
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from make_seamless import seamless, cutseam, flatten_light  # noqa: E402
from pack_web2d import wrap_resize  # noqa: E402
from pack_patterns64 import seam_ratio, edge_ratio  # noqa: E402

SRC = os.path.join(HERE, '_out', 'k93_pbr')
CANON = os.path.join(ROOT, 'saga-assets', 'textures_real')
GODOT = os.path.join(ROOT, 'saga-godot', 'assets', 'generated', 'tiles_real')
PICKS = os.path.join(HERE, 'data', 'k93_picks.json')

# seam: cut|blend · strength: 법선 세기 · invert: 밝은 곳이 홈 · rough: (base, var) · flat: 조명 평탄화(기본 FLATTEN) · trim: 견본 가장자리 버리는 비율
SETS = {
    'grass':     dict(seam='blend', strength=2.0, invert=False, rough=(0.85, 0.10), flat=1.0),   # 0.7 은 2×2 에 얼룩 격자
    'dirt':      dict(seam='blend', strength=2.5, invert=False, rough=(0.90, 0.08)),
    'gravel':    dict(seam='cut',   strength=4.0, invert=False, rough=(0.80, 0.15)),
    'rock':      dict(seam='blend', strength=4.0, invert=False, rough=(0.75, 0.15)),
    'sand':      dict(seam='blend', strength=1.5, invert=False, rough=(0.92, 0.05)),
    'snow':      dict(seam='blend', strength=1.5, invert=False, rough=(0.55, 0.15)),
    'stonewall': dict(seam='cut',   strength=5.0, invert=False, rough=(0.80, 0.15)),
    'planks':    dict(seam='cut',   strength=2.5, invert=False, rough=(0.70, 0.15)),
    'plaster':   dict(seam='blend', strength=1.2, invert=False, rough=(0.85, 0.06)),
    'rooftile':  dict(seam='cut',   strength=4.0, invert=False, rough=(0.65, 0.15), flat=1.0),   # △ 엇갈린 줄은 세로 줄눈이 없어 자른 자리에 세로 줄(띠 섞기는 이음 검사 실패 4.0, 10-13)
    'rust':      dict(seam='blend', strength=2.0, invert=False, rough=(0.70, 0.20)),
    'paving':    dict(seam='cut',   strength=3.5, invert=False, rough=(0.80, 0.12)),
    # K-0113 world-forge 재질(Poly Haven 대체) 새 4세트
    'concrete':  dict(seam='blend', strength=1.5, invert=False, rough=(0.85, 0.08)),
    'brick':     dict(seam='cut',   strength=3.5, invert=False, rough=(0.80, 0.12)),
    'thatch':    dict(seam='blend', strength=3.0, invert=False, rough=(0.90, 0.08)),
    'corrugated': dict(seam='blend', strength=3.0, invert=False, rough=(0.55, 0.20)),
    # K-0193 — ground_mix.py 코드 섞음(이미 감싼 이음 — blend 는 다시 해도 무해)
    'mud_gravel': dict(seam='blend', strength=3.0, invert=False, rough=(0.85, 0.12)),
    'path_grass': dict(seam='blend', strength=2.5, invert=False, rough=(0.88, 0.10)),
    'field_mix':  dict(seam='blend', strength=2.0, invert=False, rough=(0.87, 0.10), flat=1.0),
}
FLATTEN = 0.7
HI = 1024          # 1024² 견본(2048 은 480초·1152 는 장당 4분+ 10-13) — 이보다 크면 줄이기만


def flatten(img, k=FLATTEN):
    return Image.fromarray(np.clip(flatten_light(np.asarray(img, dtype=np.float32), k), 0, 255).astype(np.uint8))


def tile_color(name, img):
    s = SETS[name]
    if s.get('trim'):
        w, h = img.size
        m = int(min(w, h) * s['trim'])
        img = img.crop((m, m, w - m, h - m))
    if s['seam'] == 'cut':
        t = cutseam(img)
    else:
        t = seamless(img, min(min(img.size), HI))
    if t.size[0] > HI:          # 줄이기만(늘려 붙이지 않는다)
        t = wrap_resize(t, HI)
    return flatten(t, s.get('flat', FLATTEN))


def maps(name, color):
    s = SETS[name]
    a = np.asarray(color, dtype=np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    n = lum.shape[0]
    h = lum - ndimage.gaussian_filter(lum, n / 24, mode='wrap')
    h = ndimage.gaussian_filter(h, 0.6, mode='wrap')
    if s['invert']:
        h = -h
    lo, hi = np.percentile(h, 1), np.percentile(h, 99)
    h = np.clip((h - lo) / max(hi - lo, 1e-6), 0, 1)
    k = s['strength'] * n / 1024
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2 * k
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2 * k
    nv = np.stack([-dx, dy, np.ones_like(h)], -1)          # 그림 y 는 아래 → OpenGL Y+ 는 +dy
    nv /= np.linalg.norm(nv, axis=-1, keepdims=True)
    base, var = s['rough']
    r = np.clip(base + var * (0.5 - h) * 2, 0.05, 1.0)
    u8 = lambda x: Image.fromarray(np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8))
    return {'': color, '_n': u8(nv * 0.5 + 0.5), '_r': u8(r), '_h': u8(h)}


def main():
    a = sys.argv[1:]
    sys.stdout.reconfigure(encoding='utf-8')
    picks = json.load(open(PICKS, encoding='utf-8'))
    sets = a[a.index('--sets') + 1].split(',') if '--sets' in a else list(SETS)
    write = '--check' not in a
    png_dir = os.path.abspath(a[a.index('--png') + 1]) if '--png' in a else None
    rows, bad, total = [], [], 0
    for name in sets:
        src = os.path.join(SRC, picks[name])
        color = tile_color(name, Image.open(src).convert('RGB'))
        arr = np.asarray(color)
        sr, er = seam_ratio(arr), edge_ratio(arr)
        ok = sr <= 3.0 and er <= 1.6
        size = color.size[0]
        m = maps(name, color)
        print('PBR %-10s %s %s %dpx seam %.2f edge %.2f %s' % (name, picks[name], SETS[name]['seam'], size, sr, er, 'OK' if ok else 'FAIL'))
        (rows if ok else bad).append((name, m))
        if png_dir and ok:          # K-0099 유니티 — 같은 맵을 무손실 PNG 로(유니티 임포터는 WebP 를 못 읽음), 고돗·정본은 안 건드림
            d = os.path.join(png_dir, name)
            os.makedirs(d, exist_ok=True)
            for suf, im in m.items():
                for tag, px in (('hi', size), ('512', 512)):
                    out = im if px == size else wrap_resize(im.convert('RGB'), px)
                    if suf in ('_r', '_h'):
                        out = out.convert('L')
                    q = os.path.join(d, '%s_%s%s.png' % (name, tag, suf))
                    out.save(q, optimize=True)
                    total += os.path.getsize(q)
            shutil.copy(os.path.join(CANON, name, name + '.license.json'), os.path.join(d, name + '.license.json'))
            continue
        if not write or not ok:
            continue
        cd = os.path.join(CANON, name)
        os.makedirs(cd, exist_ok=True)
        os.makedirs(GODOT, exist_ok=True)
        color.save(os.path.join(cd, name + '_color.png'), optimize=True)
        lic = json.load(open(os.path.splitext(src)[0] + '.license.json', encoding='utf-8'))
        lic.update(id=name, picked=picks[name], size=[size, size],
                   derived='tools/ai-art/pbr_from_albedo.py — make_seamless.%s + flatten %.1f → 법선·거칠기·높이(자체 코드) → 고돗 tiles_real hi %d·512 WebP q90'
                   % ('cutseam' if SETS[name]['seam'] == 'cut' else 'seamless', SETS[name].get('flat', FLATTEN), size))
        json.dump(lic, open(os.path.join(cd, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        for suf, im in m.items():
            for tag, px in (('hi', size), ('512', 512)):
                out = im if px == size else wrap_resize(im.convert('RGB'), px)
                if suf in ('_r', '_h'):
                    out = out.convert('L')
                p = os.path.join(GODOT, '%s_%s%s.webp' % (name, tag, suf))
                out.save(p, 'WEBP', quality=90, method=6)
                total += os.path.getsize(p)
    if '--sheet' in a:
        w = 220
        s = Image.new('RGB', (w * 5, (w + 16) * len(rows)), (30, 30, 30))
        d = ImageDraw.Draw(s)
        for r, (name, m) in enumerate(rows):
            y = r * (w + 16)
            for c, suf in enumerate(['', '_n', '_r', '_h']):
                s.paste(m[suf].convert('RGB').resize((w, w)), (c * w, y + 16))
            t = m[''].resize((w // 2, w // 2))
            for i in range(2):
                for j in range(2):
                    s.paste(t, (4 * w + i * (w // 2), y + 16 + j * (w // 2)))
            d.text((2, y + 2), '%s  color | normal | rough | height | 2x2' % name, fill=(255, 255, 255))
        s.save(a[a.index('--sheet') + 1], quality=88)
    print('PBR 끝 %d/%d · 고돗 %.1fMB' % (len(rows), len(sets), total / 1048576))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
