"""K-0015 — AI 그림이 못 만든 바닥(눈·물)을 코드로: 이음매 없는(주기) 노이즈 타일.

py tools/ai-art/make_procedural_tiles.py [출력폴더] [--px 256]
 산출: <출력>/tile_snow.png · tile_shallow_water.png (px×px) + 3×3 확인 시트 mosaics_proc.png. 시드 고정(재현).
"""
import os
import sys

import numpy as np
from PIL import Image


def periodic_noise(n, cells, rng, octaves=4):
    """n×n, 가로·세로로 이어 붙여도 끊기지 않는 값 노이즈(0~1). 격자 값을 둘러싸게 바꾼 뒤 부드럽게 키운다."""
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    c = cells
    for _ in range(octaves):
        g = rng.random((c, c)).astype(np.float32)
        gp = np.pad(g, 2, mode='wrap')
        im = Image.fromarray((gp * 255).astype(np.uint8)).resize(((c + 4) * (n // c) if n % c == 0 else n * (c + 4) // c,) * 2, Image.BICUBIC)
        a = np.asarray(im).astype(np.float32) / 255
        k = a.shape[0] // (c + 4)
        a = a[2 * k:2 * k + n, 2 * k:2 * k + n]
        if a.shape != (n, n):
            a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)).astype(np.float32) / 255
        out += a * amp
        tot += amp
        amp *= 0.5
        c *= 2
    return out / tot


def snow(n, rng):
    base = periodic_noise(n, 4, rng, 5)
    fine = periodic_noise(n, 32, rng, 2)
    v = 0.86 + 0.10 * base + 0.04 * fine
    r = v * 0.97
    g = v * 0.985
    b = np.clip(v * 1.02 + 0.03 * (1 - base), 0, 1)
    img = np.stack([r, g, b], -1)
    # 반짝임: 드문 밝은 점
    sp = (rng.random((n, n)) > 0.9965).astype(np.float32)
    sp = np.asarray(Image.fromarray((sp * 255).astype(np.uint8)).resize((n, n), Image.BOX)).astype(np.float32) / 255
    img = np.clip(img + sp[..., None] * 0.35, 0, 1)
    return img


def water(n, rng):
    w1 = periodic_noise(n, 4, rng, 3)
    w2 = periodic_noise(n, 8, rng, 3)
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    # 빛 그물(코스틱): 비틀린 좌표의 사인 곡선 마루 — 정수 주기라 이음매 없음
    u = np.abs(np.sin(np.pi * (3 * x + 2.2 * w1 + 1.5 * w2)))
    v = np.abs(np.sin(np.pi * (3 * y + 2.2 * w2 - 1.5 * w1)))
    caustic = (1 - np.minimum(u, v)) ** 8
    depth = 0.55 + 0.35 * w2
    r = 0.10 + 0.10 * depth + 0.55 * caustic
    g = 0.45 + 0.30 * depth + 0.45 * caustic
    b = 0.55 + 0.30 * depth + 0.35 * caustic
    return np.clip(np.stack([r, g, b], -1), 0, 1)


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'web_tiles_test', '_seamless')
    px = int(sys.argv[sys.argv.index('--px') + 1]) if '--px' in sys.argv else 256
    os.makedirs(dst, exist_ok=True)
    rng = np.random.default_rng(20261002)
    tiles = {'tile_snow': snow(px, rng), 'tile_shallow_water': water(px, rng)}
    mos = []
    for name, a in tiles.items():
        im = Image.fromarray((a * 255).astype(np.uint8))
        im.save(os.path.join(dst, name + '.png'))
        m = Image.new('RGB', (px * 3, px * 3))
        for i in range(3):
            for j in range(3):
                m.paste(im, (i * px, j * px))
        mos.append(m.resize((px * 3 // 2, px * 3 // 2)))
        print('ok', name)
    sheet = Image.new('RGB', (sum(m.width for m in mos), mos[0].height))
    x = 0
    for m in mos:
        sheet.paste(m, (x, 0))
        x += m.width
    sheet.save(os.path.join(dst, 'mosaics_proc.png'))


if __name__ == '__main__':
    main()
