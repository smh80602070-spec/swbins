"""K-0048 — 등급별 외형 연출: 등급 5 × (카드 틀 9분할 · 카드 배경 · 오라 시트 · 획득 연출 시트). 외형만 — 능력치·`RARITY` id 는 건드리지 않는다.

  py tools/asset-forge/raritygen.py            # _out/rarity/*  + rarity_plan.json(읽어 온 등급표) + rarity_sheet.jpg
  py tools/asset-forge/raritygen.py --check    # 계획 = 산출 수 · 글자 가독성(흰 글자 대비 ≥4.5) · 광과민 · 용량 · .license.json

등급 이름·색은 판의 `data.js` `RARITY`(5판 같은 값)를 읽는다 — 1 기본 #9aa4b2 · 2 상급 #5ec26a · 3 희귀 #4aa3f0 · 4 영웅 #b06bf0 · 5 전설 #f0a53a.
카드 틀·배경은 160×224(틀은 9분할 28px), 오라 = 128px 프레임 8장 루프(가산 `_k` + 알파 `_a`), 획득 = 12장 한 번(등급이 높을수록 크고 화려). 코드 생성·난수 고정.
"""
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import vfxgen as V  # noqa: E402

OUT = os.path.join(HERE, '_out', 'rarity')
CW, CH = 160, 224
SS = 4


def read_rarity():
    s = open(os.path.join(ROOT, 'saga-web', 'saga-go', 'js', 'data.js'), encoding='utf-8').read()
    i = s.index('var RARITY = {')
    j = s.index('};', i)
    out = {}
    for m in re.finditer(r"(\d):\s*\{\s*label:\s*'([^']*)',\s*color:\s*'(#[0-9a-fA-F]{6})',\s*name:\s*'([^']*)'", s[i:j]):
        out[int(m.group(1))] = {'label': m.group(2), 'color': m.group(3), 'name': m.group(4)}
    return out


def rgb(h):
    return tuple(int(h[k:k + 2], 16) for k in (1, 3, 5))


def mix(a, b, t):
    return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))


def diamond(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def card_frame(n, c):
    W, H = CW * SS, CH * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dark = mix(c, (0, 0, 0), 0.45)
    lw = 2.5 + 0.7 * (n - 1)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 12 * SS, outline=c + (255,), width=int(lw * SS))
    d.rounded_rectangle((8 * SS, 8 * SS, W - 8 * SS - 1, H - 8 * SS - 1), 8 * SS, outline=dark + (255,), width=int(1.5 * SS))
    if n >= 2:                                                                          # 그림 칸 선
        d.rounded_rectangle((13 * SS, 13 * SS, (CW - 13) * SS, int(CH * 0.62) * SS), 5 * SS, outline=mix(c, (255, 255, 255), 0.2) + (255,), width=SS)
    k = 15
    for cx, cy in ((k, k), (CW - k, k), (k, CH - k), (CW - k, CH - k)):
        diamond(d, cx * SS, cy * SS, (3 + n) * SS, c + (255,))
        if n >= 3:
            diamond(d, cx * SS, cy * SS, (1 + n * 0.5) * SS, dark + (255,))
    if n >= 4:                                                                          # 윗·아랫 중앙 장식
        for cy in (4, CH - 4):
            diamond(d, CW / 2 * SS, cy * SS, 6 * SS, mix(c, (255, 255, 255), 0.4) + (255,))
            for dx in (-14, 14):
                diamond(d, (CW / 2 + dx) * SS, cy * SS, 3 * SS, c + (255,))
    if n == 5:
        for t in range(6):
            y = (CH * 0.4 + t * 10) * SS
            d.line((3 * SS, y, 9 * SS, y), fill=mix(c, (255, 255, 255), 0.5) + (255,), width=SS)
            d.line(((CW - 9) * SS, y, (CW - 3) * SS, y), fill=mix(c, (255, 255, 255), 0.5) + (255,), width=SS)
        im = Image.alpha_composite(im.filter(ImageFilter.GaussianBlur(5 * SS)), im)
    return im.resize((CW, CH), Image.LANCZOS)


def card_bg(n, c):
    top = mix(c, (0, 0, 0), 0.72 - 0.02 * n)
    bot = mix(c, (0, 0, 0), 0.88)
    a = np.zeros((CH, CW, 3), np.float32)
    for y in range(CH):
        a[y] = np.array(mix(top, bot, y / (CH - 1)))
    yy, xx = np.mgrid[0:CH, 0:CW]
    if n >= 2:                                                                          # 사선 무늬
        a += (((xx + yy) % 18 < 2)[..., None] * (6 + 2 * n)).astype(np.float32)
    if n >= 3:                                                                          # 빛 알갱이
        rng = np.random.default_rng(700 + n)
        for _ in range(10 * n):
            x, y = rng.integers(8, CW - 8), rng.integers(8, CH - 8)
            a[max(0, y - 1):y + 2, max(0, x - 1):x + 2] += np.array(mix(c, (255, 255, 255), 0.5)) * 0.5
    if n >= 4:                                                                          # 가운데 광선
        ang = np.arctan2(yy - CH * 0.38, xx - CW / 2)
        rays = (np.sin(ang * (6 + n)) > 0.7)[..., None] * (10 + 4 * n)
        dist = np.sqrt((xx - CW / 2) ** 2 + (yy - CH * 0.38) ** 2)
        a += rays * np.clip(1 - dist / 140, 0, 1)[..., None] * np.array(c)[None, None, :] / 255.0 * 3
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def aura_frame(n, c, t):
    F = V.F
    L = mix(c, (255, 255, 255), 0.55)
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = F / 2, F * 0.62
    ph = 2 * math.pi * t
    for k in range(1 + n // 2):                                                         # 발밑 고리 맥동(등급이 높을수록 겹)
        life = (t + k / (1 + n // 2)) % 1
        rx, ry = 20 + 36 * life, 7 + 13 * life
        d.ellipse((cx - rx, cy + 22 - ry, cx + rx, cy + 22 + ry), outline=mix(L, c, life), width=2)
    rng = np.random.default_rng(800 + n)
    for k in range(6 + 5 * n):                                                          # 떠오르는 알갱이
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.3, 1.0) * 34
        life = (t + k / (6 + 5 * n)) % 1
        x, y = cx + math.cos(a) * rr, cy + 28 - life * 78
        s = (1.5 + 0.4 * n) * (1 - life * 0.7)
        d.ellipse((x - s, y - s, x + s, y + s), fill=mix(L, c, life))
    if n >= 4:                                                                          # 머리 위 반짝 별
        for k in range(2 + (n - 4)):
            x, y = cx + (k - 0.5) * 30, F * 0.12 + 6 * math.sin(ph + k)
            d.line((x - 6, y, x + 6, y), fill=L, width=2)
            d.line((x, y - 6, x, y + 6), fill=L, width=2)
    return V.add(im.filter(ImageFilter.GaussianBlur(0.6)), im.filter(ImageFilter.GaussianBlur(3.5)))


def acquire_frame(n, c, t):
    F = V.F
    L = mix(c, (255, 255, 255), 0.6)
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = F / 2
    r = 10 + (24 + 8 * n) * (1 - (1 - t) ** 2)
    rays = 6 + 2 * n
    for k in range(rays):
        a = k * 2 * math.pi / rays
        d.line((cx + math.cos(a) * r * 0.3, cy + math.sin(a) * r * 0.3, cx + math.cos(a) * r, cy + math.sin(a) * r), fill=L if k % 2 else c, width=2 + (k % 2) * 2)
    d.ellipse((cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55), outline=c, width=3)
    if n >= 3:
        d.ellipse((cx - r * 0.85, cy - r * 0.85, cx + r * 0.85, cy + r * 0.85), outline=mix(c, L, 0.5), width=2)
    if n >= 5:
        for k in range(8):
            a = k * math.pi / 4 + 0.4
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            d.polygon([(x, y - 6), (x + 3, y), (x, y + 6), (x - 3, y)], fill=L)
    fade = (1 - t) ** 1.2
    im = Image.eval(im, lambda v: int(v * fade))
    return V.add(im.filter(ImageFilter.GaussianBlur(0.7)), im.filter(ImageFilter.GaussianBlur(4)))


def sheet(fn, n, c, frames, loop):
    out = Image.new('RGB', (V.F * frames, V.F))
    for f in range(frames):
        t = f / frames if loop else f / (frames - 1)
        out.paste(fn(n, c, t), (f * V.F, 0))
    return out


def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def build():
    os.makedirs(OUT, exist_ok=True)
    R = read_rarity()
    assert len(R) == 5, R
    plan = {'note': 'K-0048 — 등급표는 data.js RARITY 를 읽은 것(외형만)', 'rarity': {}}
    for n, r in R.items():
        c = rgb(r['color'])
        frame = card_frame(n, c)
        bg = card_bg(n, c)
        items = {f'rarity_card_frame_{n}.png': frame, f'rarity_card_bg_{n}.png': bg}
        for name, im in items.items():
            im.save(os.path.join(OUT, name), optimize=True)
        aura = sheet(aura_frame, n, c, 8, True)
        acq = sheet(acquire_frame, n, c, 12, False)
        for base, sh, fr, loop in ((f'rarity_aura_{n}', aura, 8, True), (f'rarity_acquire_{n}', acq, 12, False)):
            sh.save(os.path.join(OUT, base + '_k.webp'), 'WEBP', quality=88, method=6)
            V.to_alpha(sh).save(os.path.join(OUT, base + '_a.webp'), 'WEBP', quality=88, method=6)
            items[base] = sh
            json.dump({'id': base, 'generator': 'tools/asset-forge/raritygen.py', 'license': 'CC0-1.0 (코드 생성 — 외부 입력 없음)', 'rarity': n, 'rarity_name': r['name'],
                       'frames': fr, 'frame_px': V.F, 'fps': V.FPS, 'loop': loop, 'pulse_hz': round(V.pulse_hz(sh, fr), 2), 'blend': 'additive (_k) / alpha (_a)'},
                      open(os.path.join(OUT, base + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        for name in (f'rarity_card_frame_{n}', f'rarity_card_bg_{n}'):
            json.dump({'id': name, 'generator': 'tools/asset-forge/raritygen.py', 'license': 'CC0-1.0 (코드 생성 — 외부 입력 없음)', 'rarity': n, 'rarity_name': r['name'],
                       'size': [CW, CH], **({'nine_slice': 28} if 'frame' in name else {})},
                      open(os.path.join(OUT, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        a = np.asarray(bg.convert('RGB')).astype(np.float32).mean(axis=(0, 1))
        cr = (1.05) / (lum(tuple(a)) + 0.05)
        plan['rarity'][n] = {**r, 'bg_mean': [round(float(v)) for v in a], 'white_text_contrast': round(float(cr), 1)}
    json.dump(plan, open(os.path.join(OUT, 'rarity_plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 미리보기
    S = Image.new('RGB', (5 * 190, 224 + 140 + 140 + 20), (60, 64, 72))
    for n in range(1, 6):
        x = (n - 1) * 190 + 15
        bg = Image.open(os.path.join(OUT, f'rarity_card_bg_{n}.png')).convert('RGBA')
        fr = Image.open(os.path.join(OUT, f'rarity_card_frame_{n}.png')).convert('RGBA')
        S.paste(bg, (x, 5), bg)
        S.paste(fr, (x, 5), fr)
        for row, base in enumerate((f'rarity_aura_{n}', f'rarity_acquire_{n}')):
            sh = Image.open(os.path.join(OUT, base + '_k.webp')).convert('RGB')
            nfr = sh.width // V.F
            pick = sh.crop((int((nfr - 1) * 0.4) * V.F, 0, int((nfr - 1) * 0.4) * V.F + V.F, V.F))
            S.paste(pick, (x, 235 + row * 140))
    S.save(os.path.join(OUT, 'rarity_sheet.jpg'), quality=88)
    print('등급', len(R), '→', OUT)


def check():
    bad = []
    total = 0
    R = json.load(open(os.path.join(OUT, 'rarity_plan.json'), encoding='utf-8'))['rarity']
    for n in R:
        for name, size in ((f'rarity_card_frame_{n}.png', (CW, CH)), (f'rarity_card_bg_{n}.png', (CW, CH)), (f'rarity_aura_{n}_k.webp', (V.F * 8, V.F)),
                           (f'rarity_aura_{n}_a.webp', (V.F * 8, V.F)), (f'rarity_acquire_{n}_k.webp', (V.F * 12, V.F)), (f'rarity_acquire_{n}_a.webp', (V.F * 12, V.F))):
            p = os.path.join(OUT, name)
            if not os.path.exists(p):
                bad.append('없음 ' + name)
                continue
            total += os.path.getsize(p)
            if Image.open(p).size != size:
                bad.append('크기 ' + name)
            lic = os.path.join(OUT, re.sub(r'_[ka]\.webp$|\.png$', '', name) + '.license.json')
            if not os.path.exists(lic):
                bad.append('license 없음 ' + name)
        if R[n]['white_text_contrast'] < 4.5:
            bad.append(f'등급 {n} 카드 배경 위 흰 글자 대비 {R[n]["white_text_contrast"]} < 4.5')
        for base in (f'rarity_aura_{n}', f'rarity_acquire_{n}'):
            if json.load(open(os.path.join(OUT, base + '.license.json'), encoding='utf-8')).get('pulse_hz', 0) > 3:
                bad.append(f'광과민 {base}')
    mb = total / 1048576
    print(f'등급 {len(R)} · 합계 {mb:.2f}MB (≤2MB)')
    if mb > 2:
        bad.append('용량 2MB 초과')
    print('RARITY_FAIL' if bad else 'RARITY_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(check())
    build()
