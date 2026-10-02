"""K-0020 포장 — 후보 그림에서 웹 2D 최종 산출을 만든다 (git 밖 _out/web2d_final/, 배치는 K-0019).

  py tools/ai-art/pack_web2d.py tiles                 타일 30 전부: 이음매 처리(make_seamless) → <판>_<종류>.webp 256px + .license.json
  py tools/ai-art/pack_web2d.py bg <picks.json>       고른 후보만 층 3겹(far·mid·near)으로 → <판>_<지역>_<층>.webp + .license.json + .layers.json
        picks.json = {"go_village_plaza": 2, ...}  (판_지역 → 후보 번호 1|2, 20지역 전부)
  py tools/ai-art/pack_web2d.py sheet                 고르기용 그림(_out/web2d_sheet/: 배경 후보 판별 5장 · 타일 모자이크 판별 5장)
점검: py tools/ai-art/check_web2d.py --final tools/ai-art/_out/web2d_final --strict
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

import make_seamless
import split_bg_layers as SL

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'web2d_final')
PLAN = json.load(open(os.path.join(HERE, 'data', 'web2d_plan.json'), encoding='utf-8'))
TILE_PX = 256


def lic_of(cand_png, extra):
    src = os.path.splitext(cand_png)[0] + '.license.json'
    d = json.load(open(src, encoding='utf-8')) if os.path.exists(src) else {}
    d.update(extra)
    return d


def save_lic(path, d):
    with open(os.path.splitext(path)[0] + '.license.json', 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def wrap_resize(im, size):
    """순환 패딩으로 만든 그림을 이음매를 깨지 않고 줄인다 — 3×3 으로 이어 붙여 줄인 뒤 가운데 한 장."""
    im = im.convert('RGB')
    w, h = im.size
    big = Image.new('RGB', (w * 3, h * 3))
    for a in range(3):
        for b in range(3):
            big.paste(im, (a * w, b * h))
    small = big.resize((size * 3, size * 3), Image.LANCZOS)
    return small.crop((size, size, size * 2, size * 2))


def seam_ok(im):
    """check_web2d 와 같은 기준: 이음매 평균차 ≤ max(한도, 1.35 × 자연 이웃 열·행 평균차)."""
    import numpy as np
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    lim_abs = float(PLAN['budget']['seam_max_diff'])
    for x, y, nat in ((a[:, 0], a[:, -1], np.abs(np.diff(a, axis=1)).mean()), (a[0], a[-1], np.abs(np.diff(a, axis=0)).mean())):
        if float(np.abs(x - y).mean()) > max(lim_abs, 1.35 * float(nat)):
            return False
    return True


def mirror_tile(im, size):
    """거울 반복 2×2 — 가장자리가 서로 같아 이음매 차이가 0 이다(대칭 무늬가 보이는 대신)."""
    im = im.convert('RGB')
    w, h = im.size
    s = min(w, h)
    q = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size // 2, size // 2), Image.LANCZOS)
    out = Image.new('RGB', (size, size))
    out.paste(q, (0, 0))
    out.paste(q.transpose(Image.FLIP_LEFT_RIGHT), (size // 2, 0))
    out.paste(q.transpose(Image.FLIP_TOP_BOTTOM), (0, size // 2))
    out.paste(q.transpose(Image.ROTATE_180), (size // 2, size // 2))
    return out


def pack_tiles():
    os.makedirs(os.path.join(FINAL, 'tile'), exist_ok=True)
    n, methods = 0, {}
    for g, spec in PLAN['games'].items():
        for t in spec['tiles']:
            src = os.path.join(OUT, 'web2d_tiles', f'tile_{g}_{t["id"]}.png')
            raw = Image.open(src)
            im = make_seamless.seamless(raw, TILE_PX)
            method = 'crossfade'
            if not seam_ok(im):
                im, method = mirror_tile(raw, TILE_PX), 'mirror'
            methods[method] = methods.get(method, 0) + 1
            dst = os.path.join(FINAL, 'tile', f'{g}_{t["id"]}.webp')
            im.save(dst, 'WEBP', quality=90, method=6)
            save_lic(dst, lic_of(src, {'id': f'{g}_{t["id"]}', 'derived': ('tools/ai-art/make_seamless.py (오프셋 + 가장자리 크로스페이드)' if method == 'crossfade' else '거울 반복 2×2(이음매 차이 0)'), 'tile_method': method, 'px': TILE_PX}))
            n += 1
    print('PACK tiles', n, methods)


def pack_bg(picks_path):
    picks = json.load(open(picks_path, encoding='utf-8'))
    os.makedirs(os.path.join(FINAL, 'bg'), exist_ok=True)
    n = 0
    for g, spec in PLAN['games'].items():
        for r in spec['bg']:
            key = f'{g}_{r["id"]}'
            k = picks.get(key)
            if k not in (1, 2):
                raise SystemExit(f'picks 에 {key} 가 없거나 1|2 가 아니다: {k}')
            src = os.path.join(OUT, 'web2d_bg', f'bg_{g}_{r["id"]}_{k}.png')
            img = Image.open(src).convert('RGB').resize((SL.W, SL.H))
            meta = {}
            for name, sp in SL.SPEC.items():
                wide = SL.layer(img, sp)
                dst = os.path.join(FINAL, 'bg', f'{key}_{name}.webp')
                wide.save(dst, 'WEBP', quality=78 if name == 'far' else 82, method=6)
                save_lic(dst, lic_of(src, {'id': f'{key}_{name}', 'picked_candidate': k, 'layer': name,
                                           'derived': 'tools/ai-art/split_bg_layers.py (좌우 왕복 이음)'}))
                meta[name] = {'y': sp['y'], 'h': sp['h'], 'speed': sp['speed'], 'w': SL.W * 2}
                n += 1
            json.dump(meta, open(os.path.join(FINAL, 'bg', f'{key}.layers.json'), 'w'), indent=1)
    print('PACK bg layers', n)


def sheets():
    d = os.path.join(OUT, 'web2d_sheet')
    os.makedirs(d, exist_ok=True)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
    for g, spec in PLAN['games'].items():
        W, H = 640, 360
        sh = Image.new('RGB', (2 * W, len(spec['bg']) * (H + 24)), (30, 40, 38))
        dr = ImageDraw.Draw(sh)
        for r, reg in enumerate(spec['bg']):
            for k in (1, 2):
                im = Image.open(os.path.join(OUT, 'web2d_bg', f'bg_{g}_{reg["id"]}_{k}.png')).convert('RGB').resize((W, H), Image.LANCZOS)
                x, y = (k - 1) * W, r * (H + 24)
                dr.text((x + 6, y + 4), f'{g}_{reg["id"]}  #{k}', fill=(230, 240, 235), font=font)
                sh.paste(im, (x, y + 24))
        sh.save(os.path.join(d, f'bg_{g}.jpg'), quality=84)
        cols = 3
        cell = TILE_PX * 2
        tiles = spec['tiles']
        ts = Image.new('RGB', (cols * cell, 2 * (cell + 24)), (30, 40, 38))
        dr = ImageDraw.Draw(ts)
        for i, t in enumerate(tiles):
            tile = Image.open(os.path.join(FINAL, 'tile', f'{g}_{t["id"]}.webp')).convert('RGB')
            mo = Image.new('RGB', (TILE_PX * 2, TILE_PX * 2))
            for a in range(2):
                for b in range(2):
                    mo.paste(tile, (a * TILE_PX, b * TILE_PX))
            x, y = (i % cols) * cell, (i // cols) * (cell + 24)
            dr.text((x + 6, y + 4), f'{g}_{t["id"]}  (2x2)', fill=(230, 240, 235), font=font)
            ts.paste(mo, (x, y + 24))
        ts.save(os.path.join(d, f'tile_{g}.jpg'), quality=84)
    print('SHEET', d)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'tiles':
        pack_tiles()
    elif cmd == 'bg':
        pack_bg(sys.argv[2])
    elif cmd == 'sheet':
        sheets()
    else:
        print(__doc__)
        sys.exit(2)
