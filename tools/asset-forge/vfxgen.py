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

# ---------------------------------------------------------------- 장판(루프 12) — 바닥 타원

# ---------------------------------------------------------------- 10-06 저녁: 잡음 장(fbm)·색 사다리 — 타격·장판을 도형에서 "불·물·연기" 질감으로(K-0039 눈 판정 "도형 위주")
_NOISE = {}


def _noise_tile(seed, size=2 * F):
    """2F 크기 부드러운 잡음(0~1, 옥타브 셋). 창을 원을 따라 옮겨 루프를 잇는다."""
    if seed not in _NOISE:
        rng = np.random.default_rng(seed)
        acc = np.zeros((size, size), np.float32)
        amp, tot = 1.0, 0.0
        for g in (6, 12, 24):
            small = Image.fromarray((rng.random((g, g)) * 255).astype(np.uint8))
            acc += amp * np.asarray(small.resize((size, size), Image.BICUBIC)).astype(np.float32) / 255
            tot += amp
            amp *= 0.5
        _NOISE[seed] = np.clip(acc / tot, 0, 1)
    return _NOISE[seed]


def fbm(seed, ox=0.0, oy=0.0):
    """F×F 잡음 창 — (ox, oy) 만큼 밀어 읽는다(0~F)."""
    n = _noise_tile(seed)
    x0, y0 = int(ox) % F, int(oy) % F
    return n[y0:y0 + F, x0:x0 + F]


def loop_fbm(seed, t, rad=18.0):
    """t(0~1) 한 바퀴에 처음으로 돌아오는 잡음 — 창을 원을 따라 옮긴다."""
    return fbm(seed, F / 2 + rad * math.cos(2 * math.pi * t), F / 2 + rad * math.sin(2 * math.pi * t))


def streaks(seed, t, xx, yy, sx=1.0, sy=0.22):
    """세로로 늘인 잡음(불길·빛줄기) — 위로 흐르고 t=1 에서 처음과 이어진다."""
    n = _noise_tile(seed)
    N = n.shape[0]
    iy = ((yy * sy + t * N) % N).astype(np.int32)
    ix = ((xx * sx) % N).astype(np.int32)
    return n[iy, ix]


def polar(cx=F / 2, cy=F / 2, sy=1.0):
    yy, xx = np.mgrid[0:F, 0:F].astype(np.float32)
    dx, dy = xx - cx, (yy - cy) / sy
    return np.sqrt(dx * dx + dy * dy), np.arctan2(dy, dx), xx, yy


def ramp(v, stops):
    """v(0~1) → 색 사다리. stops = [(값, (r,g,b)), …] 오름차순."""
    v = np.clip(v, 0, 1)
    out = np.zeros(v.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (v >= a) & (v <= b)
        f = ((v - a) / max(1e-6, b - a))[m][:, None]
        out[m] = np.array(ca, np.float32) * (1 - f) + np.array(cb, np.float32) * f
    return out


def to_img(rgb):
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def sstep(a, b, x):
    x = np.clip((x - a) / (b - a), 0, 1)
    return x * x * (3 - 2 * x)


def sparks(im, rng, n, cx, cy, r0, r1, col, size=2.0, trail=6.0, grav=0.0, t=0.0):
    """날아가는 불티 — 꼬리 선 + 머리 점."""
    d = ImageDraw.Draw(im)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        sp = rng.uniform(0.6, 1.0)
        r = r0 + (r1 - r0) * sp
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r + grav * t * t
        tx, ty = x - math.cos(a) * trail * sp, y - math.sin(a) * trail * sp - grav * t * 0.5
        d.line((tx, ty, x, y), fill=tuple(int(c * 0.6) for c in col), width=1)
        s = size * sp
        d.ellipse((x - s, y - s, x + s, y + s), fill=col)


def hit(el, t, i):
    """타격 한 번 — 10장. 터지는 중심 + 원소 질감 + 흩어지는 조각, 끝은 사그라짐."""
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(200 + i)
    cx = cy = F / 2
    r, th, xx, yy = polar(cx, cy)
    grow = 1 - (1 - t) ** 2.2
    R = 10 + 44 * grow
    fade = (1 - t) ** 1.2
    n1 = fbm(700 + i, 10 + 30 * t, 20)
    if el == 'fire':
        ring = sstep(R, R * 0.35, r + (n1 - 0.5) * 26)                                       # 일렁이는 화염구
        heat = ring * (0.55 + 0.6 * n1) * (1 - 0.75 * t)
        smoke = sstep(R * 1.1, R * 0.5, r + (n1 - 0.5) * 30) * sstep(0.25, 0.8, t) * 0.5
        rgb = ramp(heat, [(0, (0, 0, 0)), (0.25, D), (0.5, M), (0.78, L), (1.0, (255, 255, 240))]) + np.dstack([smoke * 70, smoke * 55, smoke * 50])
        im = to_img(rgb)
        sparks(im, rng, 14, cx, cy, R * 0.6, R * 1.25, L, 1.6, 7, 10, t)
    elif el == 'water':
        lobes = 0.5 + 0.5 * np.cos(9 * th + 2 * np.sin(3 * th))                                # 물방울 왕관
        crown = sstep(R * 0.55, R * 0.85, r) * sstep(R * (1.05 + 0.25 * lobes), R * 0.85, r)
        foam = sstep(R * 0.55, 0, r) * (1 - t) * (0.5 + 0.5 * n1)
        v = np.clip(crown * (0.6 + 0.5 * n1) + foam, 0, 1) * fade
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.65, M), (1.0, L)]))
        d = ImageDraw.Draw(im)
        for k in range(12):
            a = k * math.pi / 6 + rng.uniform(-0.2, 0.2)
            rr = R * (1.05 + 0.2 * rng.random())
            x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr + 40 * t * t
            s = 3.2 * (1 - t) + 1
            d.ellipse((x - s, y - s * 1.3, x + s, y + s), fill=L)
    elif el == 'lightning':
        im = to_img(np.dstack([sstep(R * 0.45, 0, r) * (1 - t) ** 2 * c for c in M]))      # 가운데 섬광
        for k in range(8):
            a = k * 2 * math.pi / 8 + rng.uniform(-0.25, 0.25)
            pts = lightning_poly(rng, (cx, cy), (cx + math.cos(a) * R * 1.1, cy + math.sin(a) * R * 1.1), 4, 9)
            draw_poly(im, pts, M, 4)
            draw_poly(im, pts, L, 2)
            if k % 2 == 0:                                                                     # 곁가지
                j = len(pts) // 2
                b = a + rng.choice([-0.7, 0.7])
                draw_poly(im, lightning_poly(rng, pts[j], (pts[j][0] + math.cos(b) * R * 0.4, pts[j][1] + math.sin(b) * R * 0.4), 3, 5), L, 1)
        im = Image.eval(im, lambda v: int(v * fade))
    elif el == 'ice':
        frost = sstep(R * 0.7, R, r) * sstep(R * 1.15, R, r) * (0.4 + 0.8 * n1)               # 서리 고리
        core = sstep(R * 0.4, 0, r) * (1 - t)
        im = to_img(ramp(np.clip(frost + core, 0, 1), [(0, (0, 0, 0)), (0.35, D), (0.7, M), (1.0, L)]))
        d = ImageDraw.Draw(im)
        for k in range(9):                                                                     # 결정 조각(밝은 면·어두운 면)
            a = k * 2 * math.pi / 9 + rng.uniform(-0.15, 0.15)
            ln = R * (0.55 + 0.45 * rng.random())
            w = 0.16 + 0.06 * rng.random()
            tip = (cx + math.cos(a) * ln, cy + math.sin(a) * ln)
            base = (cx + math.cos(a) * ln * 0.25, cy + math.sin(a) * ln * 0.25)
            l_ = (cx + math.cos(a + w) * ln * 0.5, cy + math.sin(a + w) * ln * 0.5)
            r_ = (cx + math.cos(a - w) * ln * 0.5, cy + math.sin(a - w) * ln * 0.5)
            d.polygon([base, l_, tip], fill=L)
            d.polygon([base, r_, tip], fill=M)
        sparks(im, rng, 10, cx, cy, R * 0.8, R * 1.3, (255, 255, 255), 1.2, 0, 0, t)
        im = Image.eval(im, lambda v: int(v * fade))
    elif el == 'wind':
        sw = 0.5 + 0.5 * np.sin(3 * (th - 0.09 * r) + 7 * t + (n1 - 0.5) * 3)                # 소용돌이 줄
        band = sstep(R * 0.25, R * 0.6, r) * sstep(R * 1.15, R * 0.8, r)
        v = np.clip(sstep(0.55, 0.95, sw) * band * (0.6 + 0.6 * n1), 0, 1) * fade
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.4, D), (0.75, M), (1.0, L)]))
    elif el == 'earth':
        dust = sstep(R * 1.2, R * 0.3, r + (n1 - 0.5) * 30) * (0.3 + 0.5 * n1) * sstep(0.0, 0.3, t) * fade   # 먼지구름
        im = to_img(np.dstack([dust * c * 0.9 for c in M]))
        d = ImageDraw.Draw(im)
        for k in range(11):                                                                    # 각진 돌 파편(밝은 윗면)
            a = rng.uniform(0, 2 * math.pi)
            dist = R * (0.45 + 0.6 * rng.random())
            x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist + 26 * t * t
            s = (5 + 3 * rng.random()) * (1 - 0.5 * t)
            ang = rng.uniform(0, math.pi)
            poly = [(x + math.cos(ang + q * 2.1 + rng.uniform(-0.3, 0.3)) * s, y + math.sin(ang + q * 2.1) * s * 0.8) for q in range(3)] + [(x + math.cos(ang + 5.6) * s * 0.7, y + math.sin(ang + 5.6) * s * 0.6)]
            d.polygon(poly, fill=lerp_c(M, D, 0.4))
            d.polygon(poly[:3], fill=lerp_c(L, M, 0.3))
        im = Image.eval(im, lambda v: int(v * (0.35 + 0.65 * fade)))
    else:
        rays = 0.5 + 0.5 * np.cos(14 * th + (fbm(760 + i, 0, 0)[..., ] - 0.5) * 4)            # 부드러운 빛살
        v = np.clip(sstep(R * 1.2, R * 0.2, r) * (0.35 + 0.65 * rays) + sstep(R * 0.35, 0, r), 0, 1) * fade
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.6, M), (0.85, L), (1.0, (255, 255, 255))]))
        sparks(im, rng, 12, cx, cy, R * 0.7, R * 1.3, L, 1.5, 0, 0, t)
        im = Image.eval(im, lambda v: int(v * (0.3 + 0.7 * fade)))
    return add(im.filter(ImageFilter.GaussianBlur(0.6)), glow(im, 3))


def area(el, t, i):
    """장판 루프 — 12장. 바닥 타원 안을 원소 무늬로 채우고(잡음은 원을 따라 돌아 처음으로 이어짐) 가장자리는 밝은 테."""
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(300 + i)
    cx, cy, rx, ry = F / 2, F * 0.58, F * 0.45, F * 0.21
    yy, xx = np.mgrid[0:F, 0:F].astype(np.float32)
    e = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)                               # 타원 거리(1 = 테)
    inside = sstep(1.02, 0.9, e)
    rim = sstep(0.82, 0.97, e) * sstep(1.08, 0.97, e)
    n1 = loop_fbm(800 + i, t)
    n2 = loop_fbm(850 + i, (t + 0.37) % 1, 26)
    ph = 2 * math.pi * t
    if el == 'fire':
        lava = inside * (0.35 + 0.65 * sstep(0.35, 0.75, n1)) * (0.75 + 0.25 * n2)
        yt = cy - ry * np.sqrt(np.clip(1 - ((xx - cx) / rx) ** 2, 0, 1))                     # 그 x 에서 타원 윗 테 높이
        h = (yt - yy) / (F * 0.42)                                                           # 테에서 위로 잰 높이(0 = 테)
        col = streaks(870 + i, t, xx, yy)
        flame = sstep(0.42, 0.78, col) * np.exp(-np.clip(h, 0, None) * 2.6) * sstep(-0.12, 0.02, h) * sstep(rx * 0.98, rx * 0.55, np.abs(xx - cx)) * 1.25
        v = np.clip(lava * 0.8 + flame + rim * 0.6, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.2, D), (0.5, M), (0.8, L), (1.0, (255, 255, 230))]))
    elif el == 'water':
        caus = sstep(0.42, 0.5, n1) * sstep(0.58, 0.5, n1) + sstep(0.44, 0.5, n2) * sstep(0.56, 0.5, n2)   # 물결 빛무늬
        ripple = 0.5 + 0.5 * np.cos(e * 14 - ph * 2)
        v = np.clip(inside * (0.16 + 0.5 * caus + 0.16 * ripple * (1 - e)) + rim * 0.7, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.65, M), (1.0, L)]))
    elif el == 'lightning':
        v = inside * 0.25 * (0.5 + n1) + rim * 0.5
        im = to_img(ramp(np.clip(v, 0, 1), [(0, (0, 0, 0)), (0.5, D), (1.0, M)]))
        for k in range(5):                                                                     # 바닥을 기는 전기(원을 따라 돈다)
            a = k * 2 * math.pi / 5 + ph
            b = a + 1.1
            pts = lightning_poly(np.random.default_rng(300 + i * 7 + k + int(t * 12)), (cx + math.cos(a) * rx * 0.85, cy + math.sin(a) * ry * 0.85),
                                 (cx + math.cos(b) * rx * 0.5, cy + math.sin(b) * ry * 0.5), 3, 5)
            draw_poly(im, pts, M, 3)
            draw_poly(im, pts, L, 1)
    elif el == 'ice':
        cryst = sstep(0.5, 0.7, n1) * 0.7 + sstep(0.45, 0.48, n2) * sstep(0.51, 0.48, n2) * 0.6   # 서리 결
        v = np.clip(inside * (0.14 + 0.5 * cryst) + rim * 0.7, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.7, M), (1.0, L)]))
        d = ImageDraw.Draw(im)
        for k in range(9):                                                                     # 솟은 얼음 가시(밝은 면·어두운 면)
            a = k * 2 * math.pi / 9 + 0.2
            x, y = cx + math.cos(a) * rx * 0.72, cy + math.sin(a) * ry * 0.72
            h = 12 + 6 * ((k * 7) % 3) + 2 * math.sin(ph + k)
            d.polygon([(x, y - h), (x - 4, y), (x, y + 1)], fill=L)
            d.polygon([(x, y - h), (x + 4, y), (x, y + 1)], fill=M)
    elif el == 'wind':
        th = np.arctan2((yy - cy) / ry, (xx - cx) / rx)
        sw = 0.5 + 0.5 * np.sin(4 * th - 6 * e + ph * 2 + (n1 - 0.5) * 2)                   # 도는 소용돌이
        v = np.clip(inside * (0.15 + 0.85 * sstep(0.6, 0.95, sw) * (1 - 0.5 * e)) + rim * 0.5, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.35, D), (0.7, M), (1.0, L)]))
    elif el == 'earth':
        fr = (fbm(880 + i, 0, 0) * 7) % 1                                                     # 갈라진 땅(잡음 등고선 여러 겹 = 금)
        crack = sstep(0.09, 0.0, np.minimum(fr, 1 - fr)) * sstep(0.95, 0.75, e)
        glowc = crack * (0.6 + 0.4 * (0.5 + 0.5 * math.sin(ph)))
        base = inside * (0.25 + 0.2 * n1)
        rgb = ramp(np.clip(base, 0, 1), [(0, (0, 0, 0)), (1.0, D)]) + ramp(np.clip(glowc + rim * 0.6, 0, 1), [(0, (0, 0, 0)), (0.5, M), (1.0, L)])
        im = to_img(rgb)
        sparks(im, rng, 6, cx, cy - 6, 2, 20, M, 1.4, 0, 0, t)
    else:
        th = np.arctan2((yy - cy) / ry, (xx - cx) / rx)
        runes = sstep(0.6, 0.62, e) * sstep(0.7, 0.68, e) * (0.6 + 0.4 * (0.5 + 0.5 * np.cos(12 * th + ph)))   # 빛 고리 두 겹
        inner = sstep(0.32, 0.3, np.abs(e - 0.32)) * 0
        h = (cy - yy) / (F * 0.55)
        rays = sstep(0.5, 0.8, streaks(890 + i, t, xx * 2.0, yy, 1.0, 0.18))                  # 위로 오르는 빛줄기(세로 잡음)
        pillar = rays * np.exp(-np.clip(h, 0, None) * 2.6) * (h > -0.05) * sstep(rx * 0.8, rx * 0.2, np.abs(xx - cx))
        v = np.clip(inside * 0.1 + runes * 0.85 + rim * 0.7 + pillar * 0.75 + inner, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.6, M), (0.9, L), (1.0, (255, 255, 255))]))
    return add(im.filter(ImageFilter.GaussianBlur(0.6)), glow(im, 3))


# ---------------------------------------------------------------- 상태(루프 8) — 몸 둘레 입자

def status(el, t, i):
    """상태 루프 — 8장. 몸(가운데 세로 타원) 둘레 오라: 바닥 고리 + 원소 질감(위로 흐르는 잡음) + 입자. 10-06 저녁: 점만 떠오르던 것 → 오라."""
    L, M, D = ELEMENTS[el]
    rng = np.random.default_rng(400 + i)
    yy, xx = np.mgrid[0:F, 0:F].astype(np.float32)
    cx, foot, top = F / 2, F * 0.86, F * 0.12
    body = sstep(1.0, 0.55, np.abs(xx - cx) / (F * 0.30)) * sstep(top - 6, top + 20, yy) * sstep(foot + 4, foot - 10, yy)   # 몸을 감싸는 기둥
    edge = body * sstep(0.15, 0.65, np.abs(xx - cx) / (F * 0.30))                                               # 가장자리가 진하고 가운데(몸)는 비운다
    ground = sstep(0.12, 0.0, np.abs(np.sqrt(((xx - cx) / (F * 0.34)) ** 2 + ((yy - foot) / (F * 0.07)) ** 2) - 1))
    h = np.clip((foot - yy) / (foot - top), 0, 1)
    im = None
    if el == 'fire':
        s = 0.5 * streaks(910 + i, t, xx * 2.0, yy, 1.0, 0.25) + 0.5 * streaks(915 + i, (t + 0.5) % 1, xx * 2.0 + 37, yy, 1.0, 0.3)   # 두 겹이라 늘 불길이 있다
        v = np.clip(sstep(0.42, 0.72, s) * edge * (1 - h) ** 1.4 * 1.2 + ground * 0.55, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.25, D), (0.55, M), (0.85, L), (1.0, (255, 255, 230))]))
    elif el == 'light':
        s = streaks(920 + i, t, xx * 1.5, yy, 1.0, 0.15)
        halo = sstep(0.3, 0.0, np.abs(np.sqrt(((xx - cx) / (F * 0.3)) ** 2 + ((yy - F * 0.5) / (F * 0.42)) ** 2) - 0.92))
        v = np.clip(sstep(0.55, 0.85, s) * edge * (1 - h) * 0.9 + halo * 0.12 * (1 - h) + ground * 0.6, 0, 1)
        im = to_img(ramp(v, [(0, (0, 0, 0)), (0.3, D), (0.6, M), (0.9, L), (1.0, (255, 255, 255))]))
    elif el == 'wind':
        ph = 2 * math.pi * t
        im = to_img(np.dstack([ground * 0.4 * c for c in M]))
        d = ImageDraw.Draw(im)
        for k in range(3):                                                                    # 몸을 감고 오르는 띠(앞쪽만 밝게)
            y0 = foot - 14 - k * 24
            for j in range(24):
                a0 = ph + k * 2.1 + j * 0.26
                a1 = a0 + 0.26
                p0 = (cx + math.cos(a0) * F * 0.32, y0 - j * 0.9 + math.sin(a0) * 6)
                p1 = (cx + math.cos(a1) * F * 0.32, y0 - (j + 1) * 0.9 + math.sin(a1) * 6)
                fr = (0.5 + 0.5 * math.sin(a0)) * (j / 24)
                d.line((p0, p1), fill=lerp_c(D, L, fr), width=2 + int(2 * fr))
    else:
        n = loop_fbm(930 + i, t, 14)
        mist = edge * (0.25 + 0.5 * n) * (1 - h) * (0.6 if el in ('ice', 'water') else 0.35)
        im = to_img(ramp(np.clip(mist + ground * 0.6, 0, 1), [(0, (0, 0, 0)), (0.5, D), (1.0, M)]))
    d = ImageDraw.Draw(im)
    for k in range(14):                                                                       # 입자 — 원소마다 꼴
        a = rng.uniform(0, 2 * math.pi)
        life = (t + k / 14) % 1
        x = cx + math.cos(a) * F * rng.uniform(0.18, 0.34)
        y = foot - life * (foot - top) + math.sin(a * 3 + life * 6) * 3
        fade = math.sin(math.pi * life)
        col = tuple(int(c * fade) for c in lerp_c(L, M, life))
        s = (3.0 - 1.5 * life)
        if el == 'water':
            d.ellipse((x - s, y - s, x + s, y + s), outline=col, width=1)
        elif el == 'lightning':
            pts = lightning_poly(np.random.default_rng(1000 * i + k + int(t * 8)), (x, y), (x + rng.uniform(-8, 8), y - 12), 2, 4)
            draw_poly(im, pts, col, 2)
        elif el == 'ice':
            d.line((x - s, y, x + s, y), fill=col, width=1)
            d.line((x, y - s * 1.6, x, y + s * 1.6), fill=col, width=1)
        elif el == 'earth':
            d.polygon([(x, y - s), (x + s, y + s * 0.5), (x - s * 0.8, y + s * 0.6)], fill=col)
        elif el in ('fire', 'light'):
            d.ellipse((x - s * 0.6, y - s * 0.6, x + s * 0.6, y + s * 0.6), fill=col)
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
        # 초승달 칼자국(10-06 — 흰 원호 선이 약했다): 머리가 원을 따라 돌고, 두께는 가운데가 두껍고 양끝이 뾰족, 꼬리로 갈수록 사라진다
        yy, xx = np.mgrid[0:F, 0:F]
        ang = np.arctan2(yy - cy, xx - cx)
        rr = np.hypot(xx - cx, yy - cy)
        head = math.radians(-100 + 230 * min(1.0, t * 1.4))
        span = math.radians(150) * min(1.0, 0.25 + t * 1.6)
        u = ((head - ang) % (2 * math.pi)) / max(span, 1e-3)                 # 0 = 머리, 1 = 꼬리
        inside = (u >= 0) & (u <= 1)
        R, W = 44.0, 15.0
        w = W * np.sin(np.pi * np.clip(1 - u, 0, 1) ** 0.6) + 1.0            # 머리 쪽이 두껍다
        dist = np.abs(rr - (R - 4 * u)) / (w / 2)
        core = np.clip(1 - dist, 0, 1) ** 1.4 * (1 - u) ** 0.8 * inside
        fade = 1 - max(0.0, t - 0.55) / 0.45
        col = np.dstack([core * (200 + 55 * core), core * (220 + 35 * core), core * 255]) * fade
        im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
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
        # 부드러운 연기 뭉치(그라데이션) + 잔불 — 납작한 회색 원(10-06 지적) 대신
        acc = np.zeros((F, F, 3))
        for k in range(9):
            a = rng.uniform(0, 2 * math.pi)
            r0 = rng.uniform(4, 16)
            x, y = cx + math.cos(a) * r0 * (1 + t * 1.8), cy + 10 - t * 34 + math.sin(a) * r0 * 0.5
            s_ = 12 + 20 * t + rng.uniform(-3, 3)
            g = (1 - t) ** 1.2
            tone = np.array([70, 62, 82]) * g * rng.uniform(0.75, 1.0)                # 겹쳐 더해지므로 낮게(하얗게 타지 않게)
            acc += np.asarray(radial(x, y, s_, tuple(tone), 1.6)).astype(float)
        for k in range(10):                                                # 잔불(위로 떠오르며 꺼짐)
            x = cx + rng.uniform(-28, 28)
            y = cy + 20 - (t + k / 10) % 1 * 70
            e = (1 - (t + k / 10) % 1) * (1 - t * 0.5)
            acc += np.asarray(radial(x, y, 3.5, (255 * e, 170 * e, 90 * e), 1.2)).astype(float)
        im = Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
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
        pulse = math.sin(math.pi * (0.18 + 0.82 * t)) ** 2                 # 첫 칸부터 보이게(10-06 — 0 이면 빈 칸)
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
