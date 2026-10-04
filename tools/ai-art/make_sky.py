"""K-0034 — 하늘·날씨: 시간대 4 × 분위기 3 = 하늘 파노라마 12(AI, 후보 2) + 구름 층 3(코드) + 날씨 입자 그림(코드) + 해·달 위치 표식 JSON.

  py tools/ai-art/make_sky.py batch            계획 → batches/sky.json (Illustrious-XL-v2.0, 1216×608)
  py tools/ai-art/make_sky.py sheet            고르기 시트 → _out/sky_pick.jpg
  py tools/ai-art/make_sky.py pack [picks]     고른 후보 → 좌우 이음매·극점 보정 → _out/sky_final/sky_<시간>_<분위기>.webp(2048×1024) + _1k.webp(1024×512)
                                               + 구름 `cloud_layer_01~03.webp`(2048×512 RGBA, 좌우 이음) + 입자 `fx_rain·fx_snow·fx_fog.png` + `sky_markers.json`
  py tools/ai-art/make_sky.py check            개수·크기·이음매 평균차(≤8/255)·용량(웹 1k 합계 ≤6MB)·.license.json 100%

하늘 = 하늘만 그린 가로 2:1 그림(사람·얼굴·건물 윤곽 정도만 먼 실루엣). equirect 의 위·아래 끝(극점)은 행 평균 색으로 번지게 해 한 점으로 모이는 늘어짐이 안 보이게 한다.
눈·물은 AI 가 실패하니 구름·입자는 코드(난수 고정)로 만든다. 원작·작가·실존 이름·지명 금지(gen.py BLOCK).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'sky_final')
GEN_W, GEN_H = 1216, 608
W, H = 2048, 1024
TIMES = ('dawn', 'noon', 'sunset', 'night')
MOODS = ('past', 'present', 'future')
PREFIX = 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, wide panorama, sky dome, painterly game background, sky only'
NEG = 'lowres, bad anatomy, text, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, close-up, frame, border'
TIME_TXT = {
    'dawn': 'dawn, pink and orange glow on the horizon, soft pastel sky, a few thin clouds',
    'noon': 'bright midday, deep blue sky, big white cumulus clouds, strong sunlight',
    'sunset': 'sunset, golden and crimson sky, long glowing clouds, warm light',
    'night': 'night sky, deep indigo, many stars, soft moonlight, thin clouds',
}
MOOD_TXT = {
    'past': 'over an open grassland plain and distant hills, ancient feeling, no buildings',
    'present': 'above a distant modern city skyline silhouette at the horizon, jet contrail',
    'future': 'with a huge ringed planet and a second small moon, faint aurora ribbons, tiny distant floating platforms',
}
# 해·달 위치(방위각 0=북·90=동·180=남·270=서, 고도 0=지평선): 조명 방향을 맞추는 표식
SUN = {'dawn': (95, 7), 'noon': (180, 68), 'sunset': (265, 6), 'night': (205, 42)}


def plan():
    return [(f'{t}_{m}', f'{TIME_TXT[t]}, {MOOD_TXT[m]}') for t in TIMES for m in MOODS]


def batch():
    items = []
    n = 0
    for sid, prompt in plan():
        for k in (1, 2):
            n += 1
            items.append({'id': f'sky_{sid}_{k}', 'seed': 20271004 + 53 * n, 'prompt': prompt})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'sky',
         'defaults': {'prompt_prefix': PREFIX, 'width': GEN_W, 'height': GEN_H, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
         'items': items}
    p = os.path.join(HERE, 'batches', 'sky.json')
    json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH sky', len(items), '→', p)


def sheet():
    cw, ch = 400, 200
    ids = [s for s, _ in plan()]
    out = Image.new('RGB', (cw * 2 + 6, (ch + 14) * len(ids)), (40, 40, 40))
    d = ImageDraw.Draw(out)
    for r, sid in enumerate(ids):
        for k in (1, 2):
            p = os.path.join(OUT, 'sky', f'sky_{sid}_{k}.png')
            if os.path.exists(p):
                out.paste(Image.open(p).convert('RGB').resize((cw, ch)), ((k - 1) * (cw + 6), r * (ch + 14) + 13))
            d.text(((k - 1) * (cw + 6) + 3, r * (ch + 14)), f'{sid} #{k}', fill=(255, 255, 0))
    p = os.path.join(OUT, 'sky_pick.jpg')
    out.save(p, quality=84)
    print('시트', p)


def seamless_x(img, b=0.12):
    """좌우 이음매 — 가장자리 b 폭을 서로 섞어 폭을 줄인 뒤 원래 폭으로 되돌린다(한 바퀴 돌아도 끊김 없음)."""
    a = np.asarray(img).astype(np.float32)
    h, w, c = a.shape
    n = int(w * b)
    t = np.linspace(0, 1, n, dtype=np.float32)[None, :, None]
    blend = a[:, w - n:] * (1 - t) + a[:, :n] * t
    mid = a[:, n:w - n]
    out = np.concatenate([blend, mid], axis=1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)


def fix_poles(img, frac=0.10):
    """위·아래 끝 frac 행을 그 행의 평균 색으로 번지게 한다(극점에서 한 점으로 모이는 늘어짐 숨김)."""
    a = np.asarray(img).astype(np.float32)
    h = a.shape[0]
    n = int(h * frac)
    for r in range(n):
        t = 1 - r / n                                   # 0 행(맨 위)에서 1
        for row, tt in ((r, t), (h - 1 - r, t)):
            avg = a[row].mean(axis=0, keepdims=True)
            a[row] = a[row] * (1 - tt) + avg * tt
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def seam_diff(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    left, right = a[:, 0], a[:, -1]
    nat = np.abs(np.diff(a, axis=1)).mean()
    return float(np.abs(left - right).mean()), float(nat)


def lic_of(src, extra):
    lp = os.path.splitext(src)[0] + '.license.json'
    lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {'generator': 'tools/ai-art/make_sky.py'}
    lic.update(extra)
    return lic


def noise_tile(w, h, octaves, seed):
    """좌우로 이어지는 값 잡음(가로만 주기) — 구름용."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw, gh = 4 * 2 ** o, 2 * 2 ** o + 1
        g = rng.random((gh, gw)).astype(np.float32)
        gg = np.concatenate([g, g[:, :1]], axis=1)                         # 가로 주기
        im = Image.fromarray((gg * 255).astype(np.uint8)).resize((w + w // gw, h), Image.BICUBIC)
        arr = np.asarray(im).astype(np.float32)[:, :w] / 255.0
        acc += arr * amp
        tot += amp
        amp *= 0.5
    return acc / tot


def clouds():
    out = []
    for i, (oct_, seed, cov) in enumerate(((5, 11, 0.55), (6, 23, 0.48), (4, 37, 0.62)), 1):
        n = noise_tile(2048, 512, oct_, seed)
        fade = np.clip(np.linspace(0, 1, 512)[:, None] * 4, 0, 1) * np.clip((1 - np.linspace(0, 1, 512)[:, None]) * 3, 0, 1)
        a = np.clip((n - cov) * 5.0, 0, 1) * fade
        rgb = np.dstack([np.full_like(a, 255)] * 3) * (0.85 + 0.15 * (1 - n[..., None]))
        img = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(1.2))
        p = os.path.join(FINAL, f'cloud_layer_{i:02d}.webp')
        img.save(p, 'WEBP', quality=82, method=6)
        json.dump({'id': f'cloud_layer_{i:02d}', 'generator': 'tools/ai-art/make_sky.py', 'license': 'CC0-1.0 (코드 생성 — 외부 입력 없음)', 'size': [2048, 512], 'tint': '웹·엔진이 시간대 색으로 곱한다(흰색 한 겹)'},
                  open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        out.append(p)
    return out


def particles():
    rng = np.random.default_rng(5)
    # 비 — 64×256, 비스듬한 가는 줄 여러 개
    rain = Image.new('RGBA', (64, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(rain)
    for _ in range(7):
        x, y, ln = int(rng.integers(4, 60)), int(rng.integers(0, 150)), int(rng.integers(50, 100))
        d.line((x, y, x - ln // 6, y + ln), fill=(220, 235, 255, int(rng.integers(120, 220))), width=2)
    # 눈 — 64×64 안에 부드러운 알갱이 8개
    snow = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(snow)
    for _ in range(8):
        x, y, r = int(rng.integers(6, 58)), int(rng.integers(6, 58)), int(rng.integers(2, 5))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, int(rng.integers(170, 255))))
    snow = snow.filter(ImageFilter.GaussianBlur(0.7))
    # 안개 — 256×256 부드러운 덩이
    fog = np.zeros((256, 256), np.float32)
    yy, xx = np.mgrid[0:256, 0:256]
    for _ in range(9):
        cx, cy, r = rng.uniform(40, 216), rng.uniform(40, 216), rng.uniform(40, 90)
        fog += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (r * 0.55) ** 2)))
    fog = np.clip(fog / fog.max(), 0, 1)
    fogi = Image.fromarray(np.dstack([np.full((256, 256), 235), np.full((256, 256), 240), np.full((256, 256), 245), fog * 140]).astype(np.uint8), 'RGBA')
    res = []
    for name, im, note in (('fx_rain', rain, '세로로 타일링·아래로 흐름'), ('fx_snow', snow, '타일링·천천히 낙하'), ('fx_fog', fogi, '넓게 늘여 천천히 흘림')):
        p = os.path.join(FINAL, name + '.png')
        im.save(p, optimize=True)
        json.dump({'id': name, 'generator': 'tools/ai-art/make_sky.py', 'license': 'CC0-1.0 (코드 생성 — 외부 입력 없음)', 'size': list(im.size), 'use': note},
                  open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        res.append(p)
    return res


def pack(picks_path=None):
    picks_path = picks_path or os.path.join(OUT, 'sky_picks.json')
    picks = json.load(open(picks_path, encoding='utf-8')) if os.path.exists(picks_path) else {}
    os.makedirs(FINAL, exist_ok=True)
    markers = {}
    for sid, _p in plan():
        k = picks.get(sid, 1)
        src = os.path.join(OUT, 'sky', f'sky_{sid}_{k}.png')
        im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
        im = fix_poles(seamless_x(im))
        full = os.path.join(FINAL, f'sky_{sid}.webp')
        small = os.path.join(FINAL, f'sky_{sid}_1k.webp')
        im.save(full, 'WEBP', quality=84, method=6)
        im.resize((1024, 512), Image.LANCZOS).save(small, 'WEBP', quality=80, method=6)
        t, m = sid.split('_', 1)
        az, el = SUN[t]
        markers[sid] = {'sun_az': az, 'sun_el': el, 'moons': 2 if (t == 'night' and m == 'future') else (1 if t == 'night' else 0), 'candidate': k}
        for name, size in ((f'sky_{sid}', [W, H]), (f'sky_{sid}_1k', [1024, 512])):
            d = lic_of(src.replace('.png', '.png'), {'id': name, 'picked_candidate': k, 'size': size, 'derived': 'tools/ai-art/make_sky.py pack (좌우 이음매·극점 보정)'})
            json.dump(d, open(os.path.join(FINAL, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'note': '해·달 위치 표식(방위각 0=북 90=동 180=남 270=서, 고도 0=지평선) — 조명 방향을 맞춘다', 'skies': markers},
              open(os.path.join(FINAL, 'sky_markers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    clouds()
    particles()
    print('PACK sky', len(markers), '· 구름 3 · 입자 3')


def check():
    bad = []
    total = 0
    for sid, _p in plan():
        for name, size in ((f'sky_{sid}', (W, H)), (f'sky_{sid}_1k', (1024, 512))):
            p = os.path.join(FINAL, name + '.webp')
            if not os.path.exists(p):
                bad.append('없음 ' + name)
                continue
            if Image.open(p).size != size:
                bad.append(f'크기 {name}')
            if not os.path.exists(os.path.join(FINAL, name + '.license.json')):
                bad.append('license 없음 ' + name)
            if name.endswith('_1k'):
                total += os.path.getsize(p)
            d, nat = seam_diff(p)
            if d > max(8.0, 1.35 * nat):
                bad.append(f'{name}: 이음매 차 {d:.1f} > 허용')
    for n in ('cloud_layer_01.webp', 'cloud_layer_02.webp', 'cloud_layer_03.webp', 'fx_rain.png', 'fx_snow.png', 'fx_fog.png', 'sky_markers.json'):
        if not os.path.exists(os.path.join(FINAL, n)):
            bad.append('없음 ' + n)
    mb = total / 1048576
    print(f'하늘 12 · 웹 1k 합계 {mb:.2f}MB (≤6MB)')
    if mb > 6:
        bad.append('용량 6MB 초과')
    print('SKY_FAIL' if bad else 'SKY_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'batch':
        batch()
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'pack':
        pack(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
