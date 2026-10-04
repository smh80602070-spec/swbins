"""K-0039 — 전투 이펙트 세트: 원소 7(불·물·번개·얼음·바람·땅·빛) × 동작 4(발사·타격·장판·상태) + 공용 12 = 40종을 2D 시트와 3D 파티클 프리셋으로.

  py tools/asset-forge/vfxgen.py            # _out/vfx/<id>_a.webp(알파) · <id>_k.webp(검은 바탕, 가산 합성용) + .license.json + vfx_presets.json + vfx_sheet.jpg
  py tools/asset-forge/vfxgen.py --check    # 항목 수 = 산출 수 · 시트 규격 · 용량(≤3MB) · 광과민(초당 3회 이하 밝기 펄스) · .license.json 100%

절차 생성(난수 고정) — 같은 코드면 같은 그림. 시트 = 가로 한 줄 프레임(프레임 128px, 8~12장), 알파는 밝기에서 뽑는다(가산 합성 전제).
발사·상태·장판은 루프(첫·끝 프레임이 이어짐), 타격·공용 일부는 한 번 재생. 3D 는 `vfx_presets.json` 의 입자 수·수명·색 곡선(엔진별 파티클 노드 설정은 갈래 몫).
광과민: 밝기 펄스는 프레임 12fps 기준 8장 이상에 한 번(초당 1.5회 이하). 원작 스킬·이펙트 모사 금지.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'vfx')
F = 128
FPS = 12
ELEMENTS = {  # 원소 → (밝은 색, 중간 색, 어두운 색)
    'fire': ((255, 240, 170), (255, 150, 40), (200, 50, 20)),
    'water': ((220, 245, 255), (80, 170, 240), (30, 90, 190)),
    'lightning': ((255, 255, 255), (170, 230, 255), (90, 120, 255)),
    'ice': ((240, 252, 255), (150, 220, 250), (90, 150, 220)),
    'wind': ((240, 255, 245), (150, 235, 190), (80, 170, 140)),
    'earth': ((235, 210, 160), (170, 120, 70), (95, 65, 40)),
    'light': ((255, 255, 235), (255, 225, 120), (240, 170, 60)),
}
ACTIONS = ('proj', 'hit', 'area', 'status')


def canvas():
    return Image.new('RGB', (F, F), (0, 0, 0))


def glow(img, radius):
    return Image.blend(img, img.filter(ImageFilter.GaussianBlur(radius)), 0.0) if radius <= 0 else img.filter(ImageFilter.GaussianBlur(radius))


def add(a, b):
    return Image.fromarray(np.clip(np.asarray(a).astype(np.int16) + np.asarray(b).astype(np.int16), 0, 255).astype(np.uint8))


def radial(cx, cy, r, color, power=2.0):
    yy, xx = np.mgrid[0:F, 0:F]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(r, 1e-3)
    a = np.clip(1 - d, 0, 1) ** power
    return Image.fromarray((np.dstack([a * color[0], a * color[1], a * color[2]])).astype(np.uint8))


def lightning_poly(rng, p0, p1, depth=4, jag=14):
    pts = [p0, p1]
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mid = ((a[0] + b[0]) / 2 + rng.uniform(-jag, jag), (a[1] + b[1]) / 2 + rng.uniform(-jag, jag))
            new += [mid, b]
        pts = new
        jag *= 0.55
    return pts


def draw_poly(img, pts, color, width):
    ImageDraw.Draw(img).line(pts, fill=color, width=width, joint='curve')


# ---------------------------------------------------------------- 발사(루프 8)

def proj(el, t, i):
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(100 + i)
    im = canvas()
    d = ImageDraw.Draw(im)
    cx, cy = F * 0.62, F / 2
    ph = 2 * math.pi * t
    pulse = 1.0 + 0.1 * math.sin(ph)
    if el == 'fire':                                     # 불덩이 + 뒤로 흩날리는 불꽃
        for k in range(10):
            a = rng.uniform(-0.5, 0.5)
            ln = 20 + 26 * ((k / 10 + t) % 1)
            x, y = cx - ln, cy + math.sin(a) * ln * 0.6
            r = 10 * (1 - ln / 56) + 2
            d.ellipse((x - r, y - r, x + r, y + r), fill=lerp_c(M, D, ln / 56))
        d.ellipse((cx - 16 * pulse, cy - 16 * pulse, cx + 16 * pulse, cy + 16 * pulse), fill=M)
        d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=L)
    elif el == 'water':                                  # 물방울 구 + 고리
        for k in range(3):
            rr = 14 + 8 * ((k / 3 + t) % 1)
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=lerp_c(M, D, (k / 3 + t) % 1), width=2)
        d.ellipse((cx - 14 * pulse, cy - 14 * pulse, cx + 14 * pulse, cy + 14 * pulse), fill=M)
        d.ellipse((cx - 9, cy - 11, cx - 1, cy - 3), fill=L)
        for k in range(6):
            x = cx - 18 - 30 * ((k / 6 + t) % 1)
            d.ellipse((x - 3, cy + (k - 3) * 5 - 3, x + 3, cy + (k - 3) * 5 + 3), fill=M)
    elif el == 'lightning':                              # 번쩍이는 구 + 갈라진 번개
        d.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=L)
        for k in range(5):
            a = rng.uniform(0, 2 * math.pi) + ph
            draw_poly(im, lightning_poly(rng, (cx, cy), (cx + math.cos(a) * 34, cy + math.sin(a) * 34)), L if k % 2 else M, 2)
        draw_poly(im, lightning_poly(rng, (cx - 56, cy), (cx - 12, cy), 3, 8), M, 2)
    elif el == 'ice':                                    # 돌아가는 얼음 조각
        for k in range(3):
            a = ph + k * 2 * math.pi / 3
            tip = (cx + math.cos(a) * 24, cy + math.sin(a) * 24)
            base1 = (cx + math.cos(a + 2.4) * 8, cy + math.sin(a + 2.4) * 8)
            base2 = (cx + math.cos(a - 2.4) * 8, cy + math.sin(a - 2.4) * 8)
            d.polygon([tip, base1, base2], fill=lerp_c(L, M, k / 3))
        d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=M)
        for k in range(6):
            x = cx - 20 - 30 * ((k / 6 + t) % 1)
            d.polygon([(x, cy - 5 + (k % 3) * 4), (x - 5, cy + (k % 3) * 4 - 2), (x - 2, cy + 3 + (k % 3) * 4)], fill=L)
    elif el == 'wind':                                   # 초승달 휘도는 칼날
        for k in range(3):
            a0 = ph + k * 2.1
            box = (cx - 24 + k * 2, cy - 24 + k * 2, cx + 24 - k * 2, cy + 24 - k * 2)
            d.arc(box, math.degrees(a0), math.degrees(a0) + 120, fill=lerp_c(L, M, k / 3), width=5 - k)
        for k in range(5):
            x = cx - 30 - 26 * ((k / 5 + t) % 1)
            d.line((x, cy - 14 + k * 7, x - 16, cy - 14 + k * 7), fill=M, width=2)
    elif el == 'earth':                                  # 바위 덩이 + 파편
        pts = [(cx + math.cos(ph / 2 + a) * (14 + 3 * math.sin(a * 3)), cy + math.sin(ph / 2 + a) * (14 + 3 * math.sin(a * 3))) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)]
        d.polygon(pts, fill=M)
        d.polygon([(x * 0.7 + cx * 0.3, y * 0.7 + cy * 0.3) for x, y in pts[:4]], fill=L)
        for k in range(7):
            x = cx - 22 - 30 * ((k / 7 + t) % 1)
            y = cy + math.sin(k * 2 + ph) * 12
            d.rectangle((x - 3, y - 3, x + 3, y + 3), fill=lerp_c(M, D, (k / 7 + t) % 1))
    else:                                                # light — 별 구
        for k in range(8):
            a = ph / 2 + k * math.pi / 4
            ln = 30 if k % 2 == 0 else 20
            d.line((cx, cy, cx + math.cos(a) * ln, cy + math.sin(a) * ln), fill=M, width=3 if k % 2 == 0 else 2)
        d.ellipse((cx - 11 * pulse, cy - 11 * pulse, cx + 11 * pulse, cy + 11 * pulse), fill=L)
    return add(im.filter(ImageFilter.GaussianBlur(1.0)), glow(im, 5))


def lerp_c(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))


# ---------------------------------------------------------------- 타격(한 번 10)

def hit(el, t, i):
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(200 + i)
    im = canvas()
    d = ImageDraw.Draw(im)
    cx = cy = F / 2
    r = 8 + 46 * (1 - (1 - t) ** 2)
    fade = (1 - t) ** 1.3
    if el in ('fire', 'light'):
        for k in range(12):
            a = k * math.pi / 6 + rng.uniform(-0.1, 0.1)
            r0, r1 = r * 0.35, r * (0.8 + 0.2 * (k % 2))
            d.line((cx + math.cos(a) * r0, cy + math.sin(a) * r0, cx + math.cos(a) * r1, cy + math.sin(a) * r1), fill=lerp_c(L, M, t), width=4 if k % 2 else 2)
        d.ellipse((cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5), outline=M, width=3)
    elif el == 'water':
        for k in range(2):
            rr = r * (1 - 0.25 * k)
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=lerp_c(L, M, k * 0.6), width=4 - k)
        for k in range(10):
            a = k * math.pi / 5 + rng.uniform(-0.2, 0.2)
            x, y = cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r * 0.9 - 8 * t * t * 10
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=M)
    elif el == 'lightning':
        for k in range(7):
            a = k * 2 * math.pi / 7 + rng.uniform(-0.2, 0.2)
            draw_poly(im, lightning_poly(rng, (cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r), 3, 6), L if k % 2 else M, 2)
        d.ellipse((cx - 8 * (1 - t), cy - 8 * (1 - t), cx + 8 * (1 - t), cy + 8 * (1 - t)), fill=L)
    elif el == 'ice':
        for k in range(10):
            a = k * math.pi / 5 + rng.uniform(-0.1, 0.1)
            ln = r * (0.7 + 0.3 * (k % 3) / 2)
            tip = (cx + math.cos(a) * ln, cy + math.sin(a) * ln)
            d.polygon([tip, (cx + math.cos(a + 0.18) * ln * 0.45, cy + math.sin(a + 0.18) * ln * 0.45), (cx + math.cos(a - 0.18) * ln * 0.45, cy + math.sin(a - 0.18) * ln * 0.45)], fill=lerp_c(L, M, (k % 3) / 3))
    elif el == 'wind':
        for k in range(3):
            d.arc((cx - r * (0.5 + k * 0.25), cy - r * (0.5 + k * 0.25), cx + r * (0.5 + k * 0.25), cy + r * (0.5 + k * 0.25)), 20 + k * 40 + t * 200, 130 + k * 40 + t * 200, fill=lerp_c(L, M, k / 3), width=4)
    else:
        for k in range(12):
            a = k * math.pi / 6 + rng.uniform(-0.15, 0.15)
            dist = r * (0.5 + 0.5 * rng.random())
            x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist + 14 * t * t
            s = 4 * (1 - t) + 2
            d.rectangle((x - s, y - s, x + s, y + s), fill=lerp_c(M, D, t))
        d.ellipse((cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6), outline=L, width=2)
    im = Image.eval(im, lambda v: int(v * fade))
    return add(im.filter(ImageFilter.GaussianBlur(0.8)), glow(im, 4))


# ---------------------------------------------------------------- 장판(루프 12) — 바닥 타원

def area(el, t, i):
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(300 + i)
    im = canvas()
    d = ImageDraw.Draw(im)
    cx, cy, rx, ry = F / 2, F * 0.55, F * 0.44, F * 0.2
    ph = 2 * math.pi * t
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=M, width=3)
    d.ellipse((cx - rx * 0.72, cy - ry * 0.72, cx + rx * 0.72, cy + ry * 0.72), outline=D, width=2)
    if el == 'fire':
        for k in range(14):
            a = rng.uniform(0, 2 * math.pi)
            rr = rng.uniform(0.1, 0.9)
            life = (t * 1 + k / 14) % 1
            x, y = cx + math.cos(a) * rx * rr, cy + math.sin(a) * ry * rr - 22 * life
            s = 5 * (1 - life) + 1
            d.ellipse((x - s, y - s * 1.6, x + s, y + s * 0.8), fill=lerp_c(L, D, life))
    elif el == 'water':
        for k in range(3):
            life = (t + k / 3) % 1
            d.ellipse((cx - rx * life, cy - ry * life, cx + rx * life, cy + ry * life), outline=lerp_c(L, M, life), width=2)
    elif el == 'lightning':
        for k in range(6):
            a = k * math.pi / 3 + ph
            draw_poly(im, lightning_poly(np.random.default_rng(300 + i * 7 + k), (cx, cy), (cx + math.cos(a) * rx * 0.9, cy + math.sin(a) * ry * 0.9), 3, 4), L, 1)
    elif el == 'ice':
        for k in range(10):
            a = k * 2 * math.pi / 10
            x, y = cx + math.cos(a) * rx * 0.7, cy + math.sin(a) * ry * 0.7
            d.polygon([(x, y - 14), (x - 4, y), (x + 4, y)], fill=lerp_c(L, M, k % 3 / 3))
    elif el == 'wind':
        for k in range(3):
            d.arc((cx - rx * (0.4 + 0.2 * k), cy - ry * (0.4 + 0.2 * k), cx + rx * (0.4 + 0.2 * k), cy + ry * (0.4 + 0.2 * k)), ph * 57 + k * 120, ph * 57 + 100 + k * 120, fill=lerp_c(L, M, k / 3), width=3)
    elif el == 'earth':
        for k in range(8):
            a = k * math.pi / 4 + 0.3
            draw_poly(im, [(cx, cy), (cx + math.cos(a) * rx * 0.5, cy + math.sin(a) * ry * 0.6), (cx + math.cos(a + 0.2) * rx * 0.9, cy + math.sin(a + 0.2) * ry * 0.9)], M, 2)
    else:
        for k in range(8):
            a = k * math.pi / 4 + ph / 2
            x, y = cx + math.cos(a) * rx * 0.86, cy + math.sin(a) * ry * 0.86
            d.polygon([(x, y - 4), (x + 3, y), (x, y + 4), (x - 3, y)], fill=L)
    return add(im.filter(ImageFilter.GaussianBlur(0.7)), glow(im, 4))


# ---------------------------------------------------------------- 상태(루프 8) — 몸 둘레 입자

def status(el, t, i):
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(400 + i)
    im = canvas()
    d = ImageDraw.Draw(im)
    for k in range(16):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.35, 0.8) * F * 0.4
        life = (t + k / 16) % 1
        x = F / 2 + math.cos(a) * rr
        y = F * 0.8 - life * F * 0.62 + (math.sin(a * 3 + life * 6) * 3)
        s = (4 if el in ('fire', 'light') else 3) * (1 - life * 0.7)
        col = lerp_c(L, M, life)
        if el in ('ice', 'earth'):
            d.polygon([(x, y - s * 1.6), (x - s, y), (x + s, y)], fill=col)
        elif el == 'lightning':
            d.line((x, y, x + rng.uniform(-6, 6), y - 8), fill=col, width=2)
        elif el == 'wind':
            d.arc((x - 8, y - 4, x + 8, y + 4), 0, 200, fill=col, width=2)
        else:
            d.ellipse((x - s, y - s, x + s, y + s), fill=col)
    return add(im.filter(ImageFilter.GaussianBlur(0.6)), glow(im, 3))


# ---------------------------------------------------------------- 공용 12

def common_frame(name, t, i):
    rng = np.random.default_rng(500 + i)
    im = canvas()
    d = ImageDraw.Draw(im)
    cx = cy = F / 2
    ph = 2 * math.pi * t
    if name == 'spark_hit':
        r = 8 + 40 * (1 - (1 - t) ** 2)
        for k in range(10):
            a = k * math.pi / 5 + rng.uniform(-0.15, 0.15)
            d.line((cx + math.cos(a) * r * 0.3, cy + math.sin(a) * r * 0.3, cx + math.cos(a) * r, cy + math.sin(a) * r), fill=(255, 245, 200), width=3 if k % 2 else 2)
        im = Image.eval(im, lambda v: int(v * (1 - t) ** 1.2))
    elif name == 'slash_arc':
        a0 = -60 + 130 * t
        for k in range(4):
            d.arc((cx - 46 + k * 4, cy - 46 + k * 4, cx + 46 - k * 4, cy + 46 - k * 4), a0 - 70 + k * 6, a0 + 10, fill=(255, 255, 255) if k == 0 else (200, 220, 255), width=6 - k)
        im = Image.eval(im, lambda v: int(v * (1 - max(0, t - 0.6) / 0.4)))
    elif name in ('heal_ring', 'heal_cross'):
        for k in range(3):
            life = (t + k / 3) % 1
            r = 40 * (1 - life) + 6
            d.ellipse((cx - r, F * 0.62 - r * 0.35, cx + r, F * 0.62 + r * 0.35), outline=(120, 255, 160), width=2)
        for k in range(8):
            a = rng.uniform(0, 2 * math.pi)
            life = (t + k / 8) % 1
            x, y = cx + math.cos(a) * 26, F * 0.8 - life * 70
            if name == 'heal_cross':
                d.line((x - 5, y, x + 5, y), fill=(190, 255, 205), width=3)
                d.line((x, y - 5, x, y + 5), fill=(190, 255, 205), width=3)
            else:
                d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(190, 255, 205))
    elif name in ('buff_up', 'debuff_down'):
        up = name == 'buff_up'
        col = (255, 220, 100) if up else (190, 90, 230)
        for k in range(5):
            life = (t + k / 5) % 1
            x = cx - 36 + k * 18
            y = (F * 0.85 - life * 80) if up else (F * 0.2 + life * 80)
            d.polygon([(x, y - 8 if up else y + 8), (x - 7, y + 4 if up else y - 4), (x + 7, y + 4 if up else y - 4)], fill=col)
    elif name == 'shield_bubble':
        pulse = 0.85 + 0.15 * math.sin(ph)
        d.ellipse((cx - 50 * pulse, cy - 50 * pulse, cx + 50 * pulse, cy + 50 * pulse), outline=(140, 200, 255), width=3)
        for k in range(6):
            a = k * math.pi / 3 + ph / 3
            d.polygon([(cx + math.cos(a) * 34, cy + math.sin(a) * 34), (cx + math.cos(a + 0.5) * 42, cy + math.sin(a + 0.5) * 42), (cx + math.cos(a + 1.0) * 34, cy + math.sin(a + 1.0) * 34)], outline=(190, 225, 255))
    elif name == 'death_smoke':
        for k in range(8):
            a = rng.uniform(0, 2 * math.pi)
            r0 = rng.uniform(4, 18)
            life = t
            x, y = cx + math.cos(a) * r0 * (1 + life * 2), cy - life * 30 + math.sin(a) * r0 * 0.6
            s = 10 + 16 * life
            g = int(150 * (1 - life))
            d.ellipse((x - s, y - s, x + s, y + s), fill=(g, g, g))
    elif name == 'levelup_burst':
        for k in range(14):
            a = k * math.pi / 7
            r = 12 + 46 * t
            d.line((cx + math.cos(a) * r * 0.5, cy + math.sin(a) * r * 0.5, cx + math.cos(a) * r, cy + math.sin(a) * r), fill=(255, 235, 140), width=3 if k % 2 else 2)
        d.ellipse((cx - 20 * (1 - t), cy - 20 * (1 - t), cx + 20 * (1 - t), cy + 20 * (1 - t)), fill=(255, 250, 220))
        im = Image.eval(im, lambda v: int(v * (1 - t * 0.6)))
    elif name == 'coin_pop':
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.5
            x, y = cx + math.cos(a) * 40 * t, F * 0.7 + math.sin(a) * 52 * t + 60 * t * t
            d.ellipse((x - 5, y - 5 + 2 * math.sin(ph * 2 + k), x + 5, y + 5 - 2 * math.sin(ph * 2 + k)), fill=(255, 215, 80), outline=(255, 245, 160))
        im = Image.eval(im, lambda v: int(v * (1 - max(0, t - 0.7) / 0.3)))
    elif name == 'dust_step':
        for k in range(6):
            a = math.pi + (k - 2.5) * 0.35
            r = 8 + 26 * t
            x, y = cx + math.cos(a) * r * 1.2, F * 0.78 - 4 + math.sin(a) * r * 0.25 - 10 * t
            s = 5 + 9 * t
            g = int(130 * (1 - t))
            d.ellipse((x - s, y - s * 0.7, x + s, y + s * 0.7), fill=(g, int(g * 0.9), int(g * 0.75)))
    else:                                                  # crit_flash — 밝기 펄스는 한 번(광과민)
        pulse = math.sin(math.pi * t) ** 2
        r = 20 + 40 * t
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(int(255 * pulse * 0.7),) * 3)
        for k in range(8):
            a = k * math.pi / 4 + 0.2
            d.polygon([(cx + math.cos(a) * 12, cy + math.sin(a) * 12), (cx + math.cos(a + 0.1) * r * 1.4, cy + math.sin(a + 0.1) * r * 1.4), (cx + math.cos(a - 0.1) * r * 1.4, cy + math.sin(a - 0.1) * r * 1.4)], fill=(255, 240, 180))
        im = Image.eval(im, lambda v: int(v * pulse))
    return add(im.filter(ImageFilter.GaussianBlur(0.7)), glow(im, 3))


COMMON = [('spark_hit', 8, False), ('slash_arc', 8, False), ('heal_ring', 12, True), ('heal_cross', 12, True), ('buff_up', 10, True), ('debuff_down', 10, True),
          ('shield_bubble', 12, True), ('death_smoke', 10, False), ('levelup_burst', 12, False), ('coin_pop', 10, False), ('dust_step', 8, False), ('crit_flash', 8, False)]
PLAN = []
for _el in ELEMENTS:
    PLAN += [(f'vfx_{_el}_proj', _el, 'proj', 8, True), (f'vfx_{_el}_hit', _el, 'hit', 10, False), (f'vfx_{_el}_area', _el, 'area', 12, True), (f'vfx_{_el}_status', _el, 'status', 8, True)]
PLAN += [(f'vfx_{n}', 'common', n, fr, lp) for n, fr, lp in COMMON]
FUNC = {'proj': proj, 'hit': hit, 'area': area, 'status': status}


def make(pid, el, kind, n, loop, idx):
    frames = []
    for f in range(n):
        t = f / n if loop else f / (n - 1)
        frames.append(common_frame(kind, t, idx) if el == 'common' else FUNC[kind](el, t, idx))
    sheet = Image.new('RGB', (F * n, F))
    for f, im in enumerate(frames):
        sheet.paste(im, (f * F, 0))
    return sheet


def to_alpha(sheet):
    a = np.asarray(sheet).astype(np.float32)
    al = a.max(axis=2, keepdims=True)
    rgb = np.where(al > 0, a / np.maximum(al, 1) * 255, 0)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')


def pulse_hz(sheet, n):
    """밝기 펄스 횟수 / 재생 시간(초). 프레임별 평균 밝기를 이웃 3장으로 평활화(입자 흔들림 잡음 제거)한 뒤,
    봉우리 높이가 최대의 60% 이상이고 봉우리-골짜기 진폭이 최대의 30% 이상일 때만 펄스로 센다(WCAG 식 큰 밝기 변화만)."""
    a = np.asarray(sheet).astype(np.float32)
    means = np.array([a[:, f * F:(f + 1) * F].mean() for f in range(n)])
    mx = means.max()
    if mx < 1:
        return 0.0
    sm = np.array([means[(k - 1) % n] + means[k] + means[(k + 1) % n] for k in range(n)]) / 3
    lo = sm.min()
    peaks = 0
    for k in range(n):
        if sm[k] > sm[(k - 1) % n] and sm[k] >= sm[(k + 1) % n] and sm[k] > 0.6 * sm.max() and (sm[k] - lo) > 0.3 * sm.max():
            peaks += 1
    return peaks / (n / FPS)


def build():
    os.makedirs(OUT, exist_ok=True)
    presets = {}
    for idx, (pid, el, kind, n, loop) in enumerate(PLAN):
        sheet = make(pid, el, kind, n, loop, idx)
        sheet.save(os.path.join(OUT, pid + '_k.webp'), 'WEBP', quality=88, method=6)
        to_alpha(sheet).save(os.path.join(OUT, pid + '_a.webp'), 'WEBP', quality=88, method=6)
        hz = pulse_hz(sheet, n)
        lic = {'id': pid, 'generator': 'tools/asset-forge/vfxgen.py', 'license': 'CC0-1.0 (코드 생성 — 외부 입력 없음)', 'element': el, 'kind': kind,
               'frames': n, 'frame_px': F, 'fps': FPS, 'loop': loop, 'blend': 'additive (_k = 검은 바탕 가산 합성용 · _a = 알파)', 'pulse_hz': round(hz, 2)}
        json.dump(lic, open(os.path.join(OUT, pid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        L, M, D = ELEMENTS.get(el, ((255, 255, 255), (255, 230, 150), (200, 160, 80)))
        count = {'proj': 40, 'hit': 60, 'area': 80, 'status': 30}.get(kind, 40)
        life = {'proj': 0.5, 'hit': 0.6, 'area': 1.2, 'status': 1.0}.get(kind, 0.8)
        presets[pid] = {'sheet': pid + '_k.webp', 'frames': n, 'fps': FPS, 'loop': loop, 'particles': count, 'lifetime_s': life, 'blend': 'additive',
                        'color_curve': ['#%02x%02x%02x' % L, '#%02x%02x%02x' % M, '#%02x%02x%02x' % D], 'size_curve': [0.4, 1.0, 0.2]}
    json.dump({'note': 'K-0039 3D 파티클 프리셋 — 엔진별 파티클 노드 설정(Godot GPUParticles3D·Unity ParticleSystem)은 갈래 몫. 시트 = 프레임 가로 한 줄 128px, 가산 합성.', 'presets': presets},
              open(os.path.join(OUT, 'vfx_presets.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sheet_preview()
    print('VFX', len(PLAN), '→', OUT)


def sheet_preview():
    cols = 4
    rows = (len(PLAN) + cols - 1) // cols
    out = Image.new('RGB', (cols * 520, rows * 140), (20, 20, 28))
    from PIL import ImageDraw as D
    dr = D.Draw(out)
    for i, (pid, el, kind, n, loop) in enumerate(PLAN):
        sh = Image.open(os.path.join(OUT, pid + '_k.webp')).convert('RGB')
        k = min(4, n)
        pick = [sh.crop((int(j * (n - 1) / max(1, k - 1)) * F, 0, int(j * (n - 1) / max(1, k - 1)) * F + F, F)).resize((120, 120)) for j in range(k)]
        x, y = (i % cols) * 520, (i // cols) * 140
        for j, im in enumerate(pick):
            out.paste(im, (x + j * 124, y + 18))
        dr.text((x + 3, y + 2), pid, fill=(255, 255, 0))
    out.save(os.path.join(OUT, 'vfx_sheet.jpg'), quality=82)


def check():
    bad = []
    total = 0
    for pid, el, kind, n, loop in PLAN:
        for suf in ('_k.webp', '_a.webp', '.license.json'):
            p = os.path.join(OUT, pid + suf)
            if not os.path.exists(p):
                bad.append('없음 ' + pid + suf)
                continue
            total += os.path.getsize(p)
        p = os.path.join(OUT, pid + '_k.webp')
        if os.path.exists(p) and Image.open(p).size != (F * n, F):
            bad.append(f'크기 {pid}')
        lp = os.path.join(OUT, pid + '.license.json')
        if os.path.exists(lp) and json.load(open(lp, encoding='utf-8')).get('pulse_hz', 0) > 3:
            bad.append(f'광과민 {pid} 펄스 {json.load(open(lp, encoding="utf-8"))["pulse_hz"]}Hz > 3')
    mb = total / 1048576
    print(f'VFX {len(PLAN)}종 · 합계 {mb:.2f}MB (≤3MB)')
    if mb > 3:
        bad.append('용량 3MB 초과')
    print('VFX_FAIL' if bad else 'VFX_OK')
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(check())
    build()
