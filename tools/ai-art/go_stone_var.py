"""K-0193 — 1만리 2D 돌바닥 변주(GPU·SD 안 씀). go_stone(감싼 보로노이 판석)에 이끼·금(갈라진 선)·큰 판석을 더한 셋.

  py tools/ai-art/go_stone_var.py [--out <폴더>]
      → <out>/go_stone_b(이끼)·go_stone_c(금)·go_stone_d(큰 판석 + 이끼·금 조금).webp + .license.json  (기본 out = saga-assets/web2d/tile)

go_stone 과 같은 256 주기 — 판석은 ground_tile.stone 을 그대로 쓰고(씨앗·칸 수만 다름), 이끼는 주기 잡음으로 어두운 줄눈 쪽에 번지게,
금은 주기로 감싼 걷기 선(칸 가로질러 얇고 어두운 줄). 후처리가 전부 주기라 이음이 그대로다. 색은 go_stone 의 색표.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ground_tile as gt  # noqa: E402
from edge_tiles import periodic_noise2  # noqa: E402
from water_tile import seam  # noqa: E402

N = gt.N
ROOT = gt.ROOT
# 이름: (씨앗, 한 변 칸 수, 이끼 세기, 금 개수, 설명)
VAR = {
    'go_stone_b': (18001, 7, 0.6, 0, '1만리 돌바닥 변주 — 이끼 낀 판석'),
    'go_stone_c': (18002, 6, 0.0, 7, '1만리 돌바닥 변주 — 금 간 판석'),
    'go_stone_d': (18003, 5, 0.25, 4, '1만리 돌바닥 변주 — 큰 판석(이끼·금 조금)'),
}
MOSS = np.array([66.0, 98.0, 52.0], np.float32)
MOSS_HI = np.array([104.0, 132.0, 70.0], np.float32)


def moss(rgb, seed, amount):
    """어두운 곳(줄눈·모서리)일수록, 주기 잡음이 높을수록 이끼. amount 0~1."""
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    dark = np.clip((np.percentile(lum, 55) - lum) / 28.0, 0, 1)                      # 줄눈 쪽 1
    dark = np.asarray(gt.wrap_blur(Image.fromarray((dark * 255).astype(np.uint8)), 1.6), np.float32) / 255
    noise = periodic_noise2(seed + 9, terms=((11, 1.0), (17, 0.8), (26, 0.6), (37, 0.4)))
    noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-6)
    w = np.clip((noise * 0.8 + dark * 0.9 - 0.62) * 2.6, 0, 1) * amount
    fine = periodic_noise2(seed + 11, terms=((23, 1.0), (31, 0.7)))
    fine = (fine - fine.min()) / (fine.max() - fine.min() + 1e-6)
    col = MOSS[None, None, :] * (1 - fine[..., None]) + MOSS_HI[None, None, :] * fine[..., None]
    return rgb * (1 - w[..., None]) + col * w[..., None]


def cracks(rgb, seed, count):
    """주기로 감싼 걷기 선 count 줄 — 얇고 어둡게(+ 옆에 살짝 밝은 가장자리)."""
    rng = np.random.default_rng(seed + 21)
    mask = np.zeros((N, N), np.float32)
    for _ in range(count):
        x, y = rng.uniform(0, N, 2)
        ang = rng.uniform(0, 2 * np.pi)
        for _s in range(int(rng.integers(40, 90))):
            ang += rng.normal(0, 0.35)
            x += np.cos(ang) * 2.0
            y += np.sin(ang) * 2.0
            mask[int(y) % N, int(x) % N] = 1.0
    thin = np.asarray(gt.wrap_blur(Image.fromarray((mask * 255).astype(np.uint8)), 0.7), np.float32) / 255
    thin = np.clip(thin * 2.4, 0, 1)
    lit = np.roll(thin, 1, 0) * 0.35
    out = rgb * (1 - 0.55 * thin[..., None]) + 14.0 * lit[..., None]
    return out


def make(name):
    seed, g, m, c, _ = VAR[name]
    saved = gt.STONE.get('go_stone')
    gt.STONE['go_stone'] = g
    try:
        base = gt.stone('go_stone', seed)
    finally:
        gt.STONE['go_stone'] = saved
    rgb = np.asarray(base, np.float32)
    if m:
        rgb = moss(rgb, seed, m)
    if c:
        rgb = cracks(rgb, seed, c)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def main(argv):
    out = os.path.join(ROOT, 'saga-assets', 'web2d', 'tile')
    if '--out' in argv:
        out = argv[argv.index('--out') + 1]
    os.makedirs(out, exist_ok=True)
    for n, (seed, g, m, c, desc) in VAR.items():
        im = make(n)
        p = os.path.join(out, n + '.webp')
        im.save(p, 'WEBP', quality=90, method=6)
        im2 = Image.open(p).convert('RGB')
        lic = {'id': n, 'generator': 'tools/ai-art/go_stone_var.py', 'model': '', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
               'derived': 'ground_tile.stone(감싼 보로노이 판석) + 주기 잡음 이끼·주기 걷기 금 — 256 주기 이음매 없음',
               'note': desc, 'px': N, 'date': '2026-10-30', 'ticket': 'K-0193'}
        json.dump(lic, open(os.path.join(out, n + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('GOSTONE', n, 'seam_excess=%.2f' % seam(im2), os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:])
