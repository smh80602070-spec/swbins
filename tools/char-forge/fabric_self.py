"""K-0131 옷 결 자체판 — 옛 Poly Haven 천 사진 8 을 대신하는 코드 결(밝기·높이, 이음매 없이 깔림, 결정적 · CC0).
  py tools/char-forge/fabric_self.py            # _src/self_fabric/<id>_diff_1k.png · _disp_1k.png 8쌍 + 시트 _out/k131_fabric.jpg

garments.py `photo_for()` 가 읽는 꼴 그대로: diff = 회색 밝기(평균으로 나눠 씀), disp = 높이(가운데 맞춰 씀). 크기 실측(size_mm)은 sources.json "self_fabric".
짜임: 평직(마·삼베·포플린 — 날실·씨실이 번갈아 위로, 실마다 굵기·밝기 흔들림·실 뭉침), 5매 공단(긴 뜬 실·은은한 사선), 뜨개(코마다 V 두 고리),
쇠판(긁힌 결 + 가는 흠), 가죽(세포 잡음 오돌토돌), 자카드(평직 + 꽃 무늬 돋음).
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_src', 'self_fabric')
N = 1024
# 밝기 대비(표준편차 ÷ 평균) — 옛 사진에서 한 번 잰 값(10-17). 결은 코드, 세기만 옛과 같게 해 옷 그림이 갑자기 거칠어지지 않게.
REL_STD = {'rough_linen': 0.066, 'hessian_230': 0.207, 'stretch_poplin': 0.015, 'crepe_satin': 0.016, 'knitted_fleece': 0.194,
           'metal_plate': 0.235, 'brown_leather': 0.151, 'floral_jacquard': 0.216}
SIZES = {'rough_linen': [271, 271], 'stretch_poplin': [291, 281], 'crepe_satin': [263, 268], 'floral_jacquard': [253, 384],
         'knitted_fleece': [266, 270], 'hessian_230': [269, 267], 'brown_leather': [400, 400], 'metal_plate': [500, 500]}


def rng(seed):
    return np.random.default_rng(seed)


def tile_noise(r, cells, octaves=3):
    """이음매 없는 값 잡음(격자 감쌈) 0~1."""
    acc = np.zeros((N, N), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        g = r.random((c, c)).astype(np.float32)
        y = np.linspace(0, c, N, endpoint=False)
        i0 = np.floor(y).astype(int) % c
        i1 = (i0 + 1) % c
        f = (y - np.floor(y))
        f = f * f * (3 - 2 * f)
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
        b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        acc += amp * (a * (1 - f)[:, None] + b * f[:, None])
        tot += amp
        amp *= 0.5
    return acc / tot


def plain_weave(threads, seed, slub=0.25, amp_jit=0.25):
    r = rng(seed)
    t = np.arange(N) * threads / N
    i = np.floor(t).astype(int) % threads
    f = t - np.floor(t)
    prof = np.sin(np.pi * f)                                # 실 단면(둥근 굴곡)
    thick_w = 1 + amp_jit * (r.random(threads) - 0.5)      # 실마다 굵기
    thick_f = 1 + amp_jit * (r.random(threads) - 0.5)
    lum_w = 1 + slub * (r.random(threads) - 0.5)
    lum_f = 1 + slub * (r.random(threads) - 0.5)
    X, Y = np.meshgrid(np.arange(N), np.arange(N))
    ix, iy = i[X], i[Y]
    over = ((ix + iy) % 2 == 0)                             # 날실(세로)이 위
    along_y = np.sin(np.pi * ((t[Y] % 2) / 2))              # 위·아래 번갈아 넘는 굴곡
    warp_h = prof[X] * thick_w[ix] * (0.6 + 0.4 * np.where(over, 1.0, 0.0))
    weft_h = prof[Y] * thick_f[iy] * (0.6 + 0.4 * np.where(over, 0.0, 1.0))
    h = np.maximum(warp_h, weft_h) * (0.85 + 0.15 * along_y)
    lum = np.where(warp_h >= weft_h, lum_w[ix], lum_f[iy]) * (0.75 + 0.25 * h)
    n = tile_noise(r, 8, 3)
    lum *= 0.9 + 0.2 * n                                     # 얼룩(염색 고르지 않음)
    return lum, h


def satin(seed):
    r = rng(seed)
    threads = 220
    t = np.arange(N) * threads / N
    i = np.floor(t).astype(int) % threads
    f = t - np.floor(t)
    X, Y = np.meshgrid(np.arange(N), np.arange(N))
    ix, iy = i[X], i[Y]
    tie = ((ix * 2 + iy) % 5 == 0)                          # 5매 공단 — 다섯 칸에 한 번만 묶임
    h = 0.85 + 0.1 * np.sin(np.pi * f)[Y] - 0.35 * tie
    sheen = 0.5 + 0.5 * np.sin(2 * np.pi * (X + Y) / N * 3)  # 은은한 사선 광택 띠
    lum = 0.95 + 0.02 * sheen - 0.12 * tie
    lum *= 0.95 + 0.1 * tile_noise(r, 4, 2)
    return lum, h


def knit(seed):
    r = rng(seed)
    cols, rows = 48, 64
    X, Y = np.meshgrid(np.arange(N), np.arange(N))
    u = (X * cols / N) % 1.0
    v = (Y * rows / N) % 1.0
    ci = (X * cols // N).astype(int)
    side = np.where(u < 0.5, 1.0, -1.0)
    cx = np.where(u < 0.5, 0.25, 0.75)
    dx = (u - cx) * 2.0 - side * (v - 0.5) * 0.7             # V 두 고리(기울어진 타원)
    d = np.sqrt((dx / 0.42) ** 2 + ((v - 0.5) / 0.62) ** 2)
    h = np.clip(1 - d, 0, 1) ** 0.6
    jit = 1 + 0.12 * (r.random(cols) - 0.5)
    lum = (0.7 + 0.3 * h) * jit[ci % cols]
    fuzz = tile_noise(r, 64, 2)
    lum *= 0.92 + 0.16 * fuzz
    h = h * 0.9 + 0.1 * fuzz
    return lum, h


def metal(seed):
    r = rng(seed)
    X, Y = np.meshgrid(np.arange(N), np.arange(N))
    streak = r.random(N).astype(np.float32)
    streak = np.convolve(np.tile(streak, 3), np.ones(5) / 5, 'same')[N:2 * N]
    lum = 0.85 + 0.15 * streak[Y] + 0.08 * (tile_noise(r, 6, 3) - 0.5)
    h = 0.5 + 0.1 * streak[Y]
    for _ in range(40):                                      # 가는 흠
        x0, y0 = r.integers(0, N, 2)
        a = r.uniform(-0.3, 0.3)
        L = r.integers(40, 200)
        for s in range(L):
            x, y = int(x0 + s * math.cos(a)) % N, int(y0 + s * math.sin(a)) % N
            lum[y, x] *= 0.8
            h[y, x] -= 0.15
    return lum, h


def leather(seed):
    """512 에서 잘게(알갱이 900) 만들고 1024 로 — 이음매는 감싼 거리라 그대로."""
    r = rng(seed)
    M = 512
    pts = r.random((900, 2)) * M
    X, Y = np.meshgrid(np.arange(M, dtype=np.float32), np.arange(M, dtype=np.float32))
    N_ = M
    d1 = np.full((M, M), 1e9, np.float32)
    d2 = np.full((M, M), 1e9, np.float32)
    for px, py in pts:
        dx = np.abs(X - px)
        dy = np.abs(Y - py)
        dx = np.minimum(dx, N_ - dx)
        dy = np.minimum(dy, N_ - dy)
        dd = np.sqrt(dx * dx + dy * dy)
        d2 = np.where(dd < d1, d1, np.minimum(d2, dd))
        d1 = np.minimum(d1, dd)
    edge = np.clip((d2 - d1) / 4.0, 0, 1)                    # 알갱이 사이 골
    up = lambda a: np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((N, N), Image.BICUBIC), np.float32)
    h = up(edge ** 0.7)
    lum = (0.78 + 0.22 * h) * (0.9 + 0.2 * tile_noise(r, 6, 3))
    return lum, h


def jacquard(seed):
    lum, h = plain_weave(150, seed, slub=0.1, amp_jit=0.1)
    X, Y = np.meshgrid(np.arange(N), np.arange(N))
    u, v = (X / N * 3) % 1.0 - 0.5, (Y / N * 2) % 1.0 - 0.5
    ang = np.arctan2(v, u)
    rad = np.sqrt(u * u + v * v)
    petal = 0.32 * (0.6 + 0.4 * np.cos(5 * ang))
    flower = (rad < petal).astype(np.float32)
    lum = lum * (1 - 0.18 * flower)
    h = h * 0.6 + 0.4 * flower
    return lum, h


MAKE = {'rough_linen': lambda: plain_weave(110, 11), 'hessian_230': lambda: plain_weave(48, 12, slub=0.4, amp_jit=0.45),
        'stretch_poplin': lambda: plain_weave(200, 13, slub=0.08, amp_jit=0.08), 'crepe_satin': lambda: satin(14),
        'knitted_fleece': lambda: knit(15), 'metal_plate': lambda: metal(16), 'brown_leather': lambda: leather(17),
        'floral_jacquard': lambda: jacquard(18)}


def save(a, p, rel_std=None):
    """rel_std 가 있으면 밝기 = 평균 0.5 · 표준편차 rel_std×0.5 로(대비를 옛 사진과 같게), 없으면(높이) 0~1 로 늘림."""
    a = a.astype(np.float32)
    if rel_std is None:
        a = (a - a.min()) / max(1e-6, a.max() - a.min())
    else:
        a = 0.5 + (a - a.mean()) / max(1e-6, float(a.std())) * rel_std * 0.5
        a = np.clip(a, 0, 1)
    Image.fromarray((a * 255).astype(np.uint8), 'L').save(p)


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for tid, fn in MAKE.items():
        lum, h = fn()
        save(lum, os.path.join(OUT, tid + '_diff_1k.png'), REL_STD[tid])
        save(h, os.path.join(OUT, tid + '_disp_1k.png'))
        tiles.append(tid)
    json.dump({'license': 'CC0-1.0 (코드 생성 — tools/char-forge/fabric_self.py, 외부 사진 0)', 'size_mm': SIZES},
              open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    S = 256
    sheet = Image.new('L', (S * len(tiles), S * 2), 255)
    for k, tid in enumerate(tiles):
        for j, sfx in enumerate(('diff', 'disp')):
            im = Image.open(os.path.join(OUT, '%s_%s_1k.png' % (tid, sfx))).crop((0, 0, 512, 512)).resize((S, S))
            sheet.paste(im, (k * S, j * S))
    os.makedirs(os.path.join(HERE, '_out'), exist_ok=True)
    sheet.save(os.path.join(HERE, '_out', 'k131_fabric.jpg'), quality=88)
    print('FABRIC_SELF', len(tiles), OUT)


if __name__ == '__main__':
    main()
