"""K-0061 사가국지 RTS 화면 에셋 — 코드로 되는 것: UI 아이콘 10 · 흙길 autotile 6 · 물 타일 2프레임 · 이펙트 5.

  py tools/asset-forge/rtsgen.py icons     # rts_icon_*.png (64px 알파)
  py tools/asset-forge/rtsgen.py roads     # rts_road_*.webp (64×64 알파, 직선·모서리·T·십자·끝·점)
  py tools/asset-forge/rtsgen.py water     # rts_water_1/2.webp (64×64 이음새 없는 물결 두 프레임)
  py tools/asset-forge/rtsgen.py fx        # rts_fx_*.webp (arrow·smoke·dust·fire·hitspark — vfx 규격: 128px 프레임 가로 한 줄, _k 가산·_a 알파)
  py tools/asset-forge/rtsgen.py all       # 위 네 가지
  py tools/asset-forge/rtsgen.py check     # 개수·크기·.license.json 100%·이음새(물·길 가장자리 일치)

AI 로 그리는 것(지형 바닥·건물·거점·유닛)은 `rtsai.py`. 출력 `tools/asset-forge/_out/rts/`. 글씨는 그리지 않는다.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'rts')
SS = 4
LIC = {'generator': 'tools/asset-forge/rtsgen.py', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)'}


def save(im, name, fmt='PNG', extra=None):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    if fmt == 'WEBP':
        im.save(p, 'WEBP', quality=90, method=6)
    else:
        im.save(p, optimize=True)
    d = dict(LIC)
    d.update({'id': os.path.splitext(name)[0], 'size': list(im.size)})
    d.update(extra or {})
    json.dump(d, open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- 아이콘 10
def icon(kind):
    S = 64
    W = S * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = lambda x, y: (x * W / 64, y * W / 64)
    ol = (40, 30, 24, 255)
    if kind == 'food':                                                     # 밀 이삭 다발
        for k, dx in enumerate((-9, 0, 9)):
            d.line([p(32 + dx * 0.4, 56), p(32 + dx, 22)], fill=(150, 120, 50, 255), width=int(2.5 * SS))
            for j in range(5):
                y = 24 + j * 5
                for sx in (-1, 1):
                    d.ellipse((*p(32 + dx + sx * 4 - 2.5, y - 2), *p(32 + dx + sx * 4 + 2.5, y + 3)), fill=(238, 196, 74, 255), outline=(170, 120, 30, 255))
            d.ellipse((*p(32 + dx - 2.5, 14), *p(32 + dx + 2.5, 24)), fill=(244, 206, 84, 255), outline=(170, 120, 30, 255))
        d.rectangle((*p(24, 46), *p(40, 50)), fill=(180, 60, 50, 255), outline=ol)
    elif kind == 'gold':                                                   # 동전 더미
        for i, (x, y) in enumerate(((20, 46), (36, 46), (28, 38), (28, 30))):
            d.ellipse((*p(x - 12, y - 5), *p(x + 12, y + 5)), fill=(238, 192, 66, 255), outline=(150, 100, 20, 255), width=SS)
            d.ellipse((*p(x - 7, y - 3), *p(x + 7, y + 3)), outline=(255, 232, 140, 255), width=SS)
        d.polygon([p(28, 18), p(31, 25), p(37, 25), p(32, 29), p(34, 35), p(28, 31), p(22, 35), p(24, 29), p(19, 25), p(25, 25)], fill=(255, 240, 160, 255))
    elif kind == 'pop':                                                    # 사람 둘
        for cx, c, s in ((38, (92, 150, 220), 0.9), (24, (220, 130, 80), 1.0)):
            d.ellipse((*p(cx - 7 * s, 12), *p(cx + 7 * s, 26 * s + 2)), fill=(244, 214, 176, 255), outline=ol, width=SS)
            d.pieslice((*p(cx - 13 * s, 28 * s), *p(cx + 13 * s, 62)), 180, 360, fill=c + (255,), outline=ol, width=SS)
    elif kind == 'work':                                                   # 망치
        d.line([p(18, 50), p(40, 22)], fill=(140, 96, 52, 255), width=int(6 * SS))
        d.polygon([p(32, 12), p(52, 24), p(46, 32), p(26, 20)], fill=(150, 156, 168, 255), outline=ol)
        d.line([p(18, 50), p(40, 22)], fill=(180, 128, 72, 255), width=int(2 * SS))
    elif kind == 'happy':                                                  # 웃는 얼굴
        d.ellipse((*p(8, 8), *p(56, 56)), fill=(252, 214, 92, 255), outline=(170, 110, 30, 255), width=int(2.5 * SS))
        for x in (24, 40):
            d.ellipse((*p(x - 3, 22), *p(x + 3, 32)), fill=ol)
        d.arc((*p(20, 26), *p(44, 46)), 20, 160, fill=ol, width=int(3 * SS))
    elif kind == 'troop':                                                  # 엇갈린 칼
        for sx in (-1, 1):
            d.polygon([p(32 + sx * 4, 50), p(32 + sx * 1, 50), p(32 + sx * 22, 8), p(32 + sx * 26, 12)], fill=(212, 218, 228, 255), outline=ol)
            d.line([p(32 + sx * 15, 36), p(32 + sx * 25, 40)], fill=(150, 96, 52, 255), width=int(4 * SS))
            d.ellipse((*p(32 + sx * 2 - 3, 52), *p(32 + sx * 2 + 3, 58)), fill=(190, 150, 70, 255), outline=ol)
    elif kind == 'tower':                                                  # 망루
        d.polygon([p(20, 56), p(44, 56), p(40, 22), p(24, 22)], fill=(170, 160, 142, 255), outline=ol)
        d.rectangle((*p(18, 14), *p(46, 24)), fill=(150, 140, 124, 255), outline=ol)
        for x in (20, 28, 36, 44):
            d.rectangle((*p(x - 2, 8), *p(x + 2, 14)), fill=(150, 140, 124, 255), outline=ol)
        d.rectangle((*p(29, 34), *p(35, 44)), fill=(60, 50, 44, 255))
        d.polygon([p(32, 2), p(40, 10), p(24, 10)], fill=(190, 60, 52, 255))
    elif kind == 'wall':                                                   # 성벽
        for r in range(4):
            for c in range(3):
                x = 6 + c * 18 + (9 if r % 2 else 0)
                d.rectangle((*p(x, 20 + r * 9), *p(x + 16, 28 + r * 9)), fill=(176, 166, 148, 255), outline=ol)
        for x in (6, 24, 42):
            d.rectangle((*p(x, 10), *p(x + 12, 20)), fill=(160, 150, 134, 255), outline=ol)
    elif kind == 'hero':                                                   # 별
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            r = 26 if i % 2 == 0 else 11
            pts.append(p(32 + math.cos(a) * r, 34 + math.sin(a) * r))
        d.polygon(pts, fill=(255, 214, 70, 255), outline=(170, 110, 20, 255))
    else:                                                                  # strike 일격 — 번쩍
        d.polygon([p(36, 4), p(14, 34), p(28, 34), p(22, 60), p(50, 24), p(34, 24), p(44, 4)], fill=(255, 230, 90, 255), outline=(190, 90, 20, 255))
    sh = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 90), mask=im.filter(ImageFilter.GaussianBlur(2 * SS)).getchannel('A').point(lambda v: v // 2))
    out = Image.alpha_composite(sh, im)
    return out.resize((S, S), Image.LANCZOS)


ICONS = ['food', 'gold', 'pop', 'work', 'happy', 'troop', 'tower', 'wall', 'hero', 'strike']


def build_icons():
    for k in ICONS:
        save(icon(k), f'rts_icon_{k}.png', extra={'kind': k})
    print('아이콘', len(ICONS))


# ---------------------------------------------------------------- 흙길 autotile 6
def road_piece(conn, dirt):
    """conn = 열린 방향 집합({'N','E','S','W'}). 중심선 폭 ≈26px, 가장자리는 주기 파동(타일 경계에서 이어짐), 안쪽은 흙 질감."""
    T = 64
    yy, xx = np.mgrid[0:T, 0:T].astype(np.float32)
    ends = {'N': (32, -1), 'S': (32, 65), 'W': (-1, 32), 'E': (65, 32)}
    d = np.full((T, T), 1e3, np.float32)
    for c in conn:
        ex, ey = ends[c]
        cx, cy = 32.0, 32.0
        vx, vy = ex - cx, ey - cy
        t = np.clip(((xx - cx) * vx + (yy - cy) * vy) / (vx * vx + vy * vy), 0, 1)
        px, py = cx + vx * t, cy + vy * t
        d = np.minimum(d, np.sqrt((xx - px) ** 2 + (yy - py) ** 2))
    if not conn:
        d = np.sqrt((xx - 32) ** 2 + (yy - 32) ** 2)
    wob = 2.2 * np.sin(2 * np.pi * 2 * xx / T + 1.3) * np.sin(2 * np.pi * 3 * yy / T + 0.4) + 1.6 * np.sin(2 * np.pi * 5 * (xx + yy) / T)
    r = 12.5 + wob * 0.6
    a = np.clip((r + 1.2 - d) / 2.4, 0, 1)
    tex = np.asarray(dirt.convert('RGB').resize((T, T), Image.LANCZOS)).astype(np.float32)
    edge = np.clip((d - (r - 5)) / 5, 0, 1)[..., None]                                # 가장자리 어둡게(바퀴 자국 느낌)
    rgb = tex * (1 - 0.25 * edge) * np.array([1.05, 0.98, 0.9])
    rgb += 8 * np.sin(2 * np.pi * 4 * yy / T)[..., None] * (1 - edge) * 0.3          # 가운데 약한 바퀴 자국
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA')


ROADS = {'straight': {'E', 'W'}, 'corner': {'N', 'E'}, 'tee': {'W', 'E', 'S'}, 'cross': {'N', 'E', 'S', 'W'}, 'end': {'W'}, 'dot': set()}


def build_roads():
    dirt = Image.open(os.path.join(ROOT, 'saga-assets', 'web2d', 'tile', 'forest_dirt.webp'))
    for name, conn in ROADS.items():
        save(road_piece(conn, dirt), f'rts_road_{name}.webp', 'WEBP', {'open': sorted(conn), 'note': '기준 방향 그림 — 엔진이 90° 회전해 쓴다(direction 표기: 열린 방향)', 'seamless': 'edge_midpoint'})
    print('길', len(ROADS))


# ---------------------------------------------------------------- 물 2프레임
def build_water():
    T = 64
    yy, xx = np.mgrid[0:T, 0:T].astype(np.float32)
    for f in (0, 1):
        ph = f * math.pi
        h = np.zeros((T, T), np.float32)
        for kx, ky, a, p0 in ((1, 2, 1.0, 0.3), (2, 1, 0.8, 1.7), (3, 2, 0.5, 2.9), (2, 3, 0.45, 0.9), (4, 1, 0.3, 4.1)):
            h += a * np.sin(2 * np.pi * (kx * xx + ky * yy) / T + p0 + ph * (1 if (kx + ky) % 2 else -1))
        h = (h - h.min()) / (h.max() - h.min())
        base = np.array([46, 108, 168], np.float32)
        light = np.array([140, 205, 238], np.float32)
        crest = np.clip((h - 0.72) / 0.28, 0, 1)[..., None]
        rgb = base * (1 - h[..., None] * 0.35) + light * crest * 0.75 + np.array([10, 24, 40]) * (0.5 - h[..., None]) * 0.5
        save(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), f'rts_water_{f + 1}.webp', 'WEBP', {'frame': f + 1, 'frames': 2, 'seamless': 'periodic', 'note': '두 프레임을 0.6~0.8초마다 번갈아 그린다'})
    print('물 2')


# ---------------------------------------------------------------- 이펙트 5 (vfx 규격)
sys.path.insert(0, HERE)
import vfxgen as V  # noqa: E402


def fx_arrow(t):
    F = V.F
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    x0 = 24 + 40 * t
    y = F / 2 + 3 * math.sin(2 * math.pi * t)
    d.line((x0 - 40, y, x0 + 30, y), fill=(190, 160, 110), width=3)
    d.polygon([(x0 + 44, y), (x0 + 28, y - 7), (x0 + 28, y + 7)], fill=(220, 224, 232))
    for k in (-1, 1):
        d.polygon([(x0 - 40, y), (x0 - 52, y + k * 9), (x0 - 30, y)], fill=(210, 80, 70))
    trail = Image.new('RGB', (F, F), (0, 0, 0))
    ImageDraw.Draw(trail).line((x0 - 90, y, x0 - 40, y), fill=(120, 110, 90), width=2)
    return V.add(V.add(im.filter(ImageFilter.GaussianBlur(0.6)), trail.filter(ImageFilter.GaussianBlur(2))), im.filter(ImageFilter.GaussianBlur(3)))


def fx_smoke(t):
    F = V.F
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(900)
    for k in range(7):
        life = (t + k / 7) % 1
        x = F / 2 + math.sin(life * 5 + k) * 10 + rng.uniform(-3, 3)
        y = F * 0.82 - life * F * 0.7
        s = 8 + 20 * life
        g = int(150 * (1 - life) ** 1.2)
        d.ellipse((x - s, y - s, x + s, y + s), fill=(g, g, int(g * 0.95)))
    return im.filter(ImageFilter.GaussianBlur(2.2))


def fx_dust(t):
    F = V.F
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for k in range(9):
        a = math.pi + (k - 4) * 0.4
        r = 10 + 34 * t
        x, y = F / 2 + math.cos(a) * r * 1.4, F * 0.75 + math.sin(a) * r * 0.3 - 14 * t
        s = 6 + 12 * t
        g = int(140 * (1 - t) ** 1.2)
        d.ellipse((x - s, y - s * 0.7, x + s, y + s * 0.7), fill=(g, int(g * 0.88), int(g * 0.7)))
    return im.filter(ImageFilter.GaussianBlur(1.6))


def fx_fire(t):
    F = V.F
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(910)
    for k in range(5):
        cx = F * 0.3 + k * F * 0.1
        h = 40 + 26 * abs(math.sin(2 * math.pi * t + k * 1.7))
        d.polygon([(cx - 11, F * 0.9), (cx - 3, F * 0.9 - h * 0.6), (cx + 1, F * 0.9 - h), (cx + 4, F * 0.9 - h * 0.55), (cx + 11, F * 0.9)], fill=(240, 110, 30))
        d.polygon([(cx - 6, F * 0.9), (cx, F * 0.9 - h * 0.7), (cx + 6, F * 0.9)], fill=(255, 210, 90))
    for k in range(8):
        life = (t + k / 8) % 1
        x = F * 0.2 + rng.uniform(0, F * 0.6)
        y = F * 0.8 - life * 90
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 190, 80))
    return V.add(im.filter(ImageFilter.GaussianBlur(1.0)), im.filter(ImageFilter.GaussianBlur(5)))


def fx_hitspark(t):
    F = V.F
    im = Image.new('RGB', (F, F), (0, 0, 0))
    d = ImageDraw.Draw(im)
    r = 8 + 32 * (1 - (1 - t) ** 2)
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        d.line((F / 2 + math.cos(a) * r * 0.3, F / 2 + math.sin(a) * r * 0.3, F / 2 + math.cos(a) * r, F / 2 + math.sin(a) * r), fill=(255, 235, 170), width=3)
    im = Image.eval(im, lambda v: int(v * (1 - t) ** 1.2))
    return V.add(im.filter(ImageFilter.GaussianBlur(0.8)), im.filter(ImageFilter.GaussianBlur(3)))


FX = [('arrow', fx_arrow, 6, True), ('smoke', fx_smoke, 12, True), ('dust', fx_dust, 8, False), ('fire', fx_fire, 12, True), ('hitspark', fx_hitspark, 6, False)]


def build_fx():
    for name, fn, n, loop in FX:
        sheet = Image.new('RGB', (V.F * n, V.F))
        for f in range(n):
            sheet.paste(fn(f / n if loop else f / (n - 1)), (f * V.F, 0))
        pid = f'rts_fx_{name}'
        save(sheet, pid + '_k.webp', 'WEBP', {'id': pid + '_k', 'frames': n, 'frame_px': V.F, 'fps': V.FPS, 'loop': loop, 'blend': 'additive'})
        save(V.to_alpha(sheet), pid + '_a.webp', 'WEBP', {'id': pid + '_a', 'frames': n, 'frame_px': V.F, 'fps': V.FPS, 'loop': loop, 'blend': 'alpha', 'pulse_hz': round(V.pulse_hz(sheet, n), 2)})
    print('이펙트', len(FX))


def check():
    bad = []
    need = [f'rts_icon_{k}.png' for k in ICONS] + [f'rts_road_{k}.webp' for k in ROADS] + ['rts_water_1.webp', 'rts_water_2.webp'] + \
           [f'rts_fx_{n}_{s}.webp' for n, _f, _n, _l in FX for s in ('k', 'a')]
    for n in need:
        p = os.path.join(OUT, n)
        if not os.path.exists(p):
            bad.append('없음 ' + n)
            continue
        if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
            bad.append('license 없음 ' + n)
    for n in [f'rts_icon_{k}.png' for k in ICONS]:
        if os.path.exists(os.path.join(OUT, n)) and Image.open(os.path.join(OUT, n)).size != (64, 64):
            bad.append('크기 ' + n)
    for n in [f'rts_road_{k}.webp' for k in ROADS] + ['rts_water_1.webp', 'rts_water_2.webp']:
        p = os.path.join(OUT, n)
        if os.path.exists(p) and Image.open(p).size != (64, 64):
            bad.append('크기 ' + n)
    for f in (1, 2):                                                       # 물 이음새: 좌우·상하 가장자리 평균차가 이웃 열 평균차 정도
        p = os.path.join(OUT, f'rts_water_{f}.webp')
        if os.path.exists(p):
            a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
            wrap = np.abs(a[:, 0] - a[:, -1]).mean()
            nat = np.abs(np.diff(a, axis=1)).mean()
            if wrap > max(8.0, 1.5 * nat):
                bad.append(f'물 {f} 이음새 차 {wrap:.1f}')
    # 길 가장자리 일치: 'straight' 의 좌우 열이 같아야 길이 이어진다
    p = os.path.join(OUT, 'rts_road_straight.webp')
    if os.path.exists(p):
        a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
        if np.abs(a[:, 0] - a[:, -1]).mean() > 12:
            bad.append('길 straight 좌우 가장자리 불일치')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if not f.endswith('.json')) / 1048576 if os.path.exists(OUT) else 0
    print(f'RTS 코드분 {len(need)}종 · {total:.2f}MB')
    print('RTSGEN_FAIL' if bad else 'RTSGEN_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd in ('icons', 'all'):
        build_icons()
    if cmd in ('roads', 'all'):
        build_roads()
    if cmd in ('water', 'all'):
        build_water()
    if cmd in ('fx', 'all'):
        build_fx()
    if cmd == 'check':
        sys.exit(check())
    if cmd not in ('icons', 'roads', 'water', 'fx', 'all', 'check'):
        print(__doc__)
