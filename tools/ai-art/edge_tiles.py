"""K-0091 단계 2 — 3마을 2D 땅 이음 타일(알파 가장자리)을 두 바탕 타일에서 코드로 합성한다(GPU 안 씀).

  py tools/ai-art/edge_tiles.py <A 타일> <이름 꼬리> [--out <폴더>] [--foam]
      A = 넘어 들어오는 땅(풀 등, 256 이음매 없는 webp/png) · 꼬리 = grass_dirt 처럼
      → <out>/forest_edge_<꼬리>.webp   변: 위쪽 가장자리에서 A 가 들어온다(좌우 이음 — 물결 경계가 가로 주기)
        <out>/forest_corner_<꼬리>.webp 바깥 모서리: 왼쪽 위 모서리에서 A 가 둥글게 들어온다
      --foam: 경계 바로 바깥에 밝은 거품 띠(땅↔물)
웹은 B 칸 위에 이 그림을 얹고 방향에 맞게 90° 돌려 쓴다(한 방향 기준, K-0091). 경계는 가로 주기 잡음이라
변 타일끼리 옆으로 이어 붙여도 끊기지 않는다. 결과는 알파 RGBA 256px.
"""
import os
import sys

import numpy as np
from PIL import Image

PX = 256
DEPTH = 0.36      # 변: A 가 들어오는 깊이(타일 높이 비율, 물결 가운데)
WAVE = 0.07       # 물결 세기
SOFT = 6.0        # 경계 부드러움(px)


def periodic_noise(n, seed, octaves=((3, 1.0), (7, 0.5), (13, 0.25))):
    """길이 n 의 주기 잡음(0 기준, 대략 -1..1) — 사인 몇 개를 씨앗 위상으로 섞는다."""
    rng = np.random.default_rng(seed)
    x = np.arange(n) / n * 2 * np.pi
    v = np.zeros(n)
    for k, amp in octaves:
        v += amp * np.sin(k * x + rng.uniform(0, 2 * np.pi))
    return v / sum(a for _, a in octaves)


def load(p):
    im = Image.open(p).convert('RGBA')
    if im.size != (PX, PX):
        im = im.resize((PX, PX), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def edge_alpha(seed):
    yy = np.arange(PX)[:, None].astype(np.float32)
    line = (DEPTH + WAVE * periodic_noise(PX, seed)) * PX           # 열마다 경계 높이
    return np.clip((line[None, :] - yy) / SOFT + 0.5, 0, 1), line


def corner_alpha(seed):
    yy, xx = np.indices((PX, PX)).astype(np.float32)
    ang = np.arctan2(yy, xx)                                        # 0..pi/2
    t = (ang / (np.pi / 2) * PX).astype(int).clip(0, PX - 1)
    r0 = (DEPTH * 1.25 + WAVE * periodic_noise(PX, seed + 1)[t]) * PX
    r = np.hypot(xx, yy)
    return np.clip((r0 - r) / SOFT + 0.5, 0, 1), r0, r


def foam(alpha_dist, width=5.0):
    """경계 바깥 쪽 밝은 띠 — alpha_dist = 경계까지 거리(px, 바깥 +)."""
    return np.clip(1 - np.abs(alpha_dist - width * 0.6) / width, 0, 1) * 0.55


def compose(a_img, alpha, foam_band=None):
    rgb = a_img[..., :3].copy()
    out_a = alpha.copy()
    if foam_band is not None:
        rgb = rgb * (1 - foam_band[..., None]) + 245 * foam_band[..., None]
        out_a = np.maximum(out_a, foam_band)
    return Image.fromarray(np.dstack([rgb.clip(0, 255), (out_a * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    src, tail = a[0], a[1]
    out = a[a.index('--out') + 1] if '--out' in a else os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'k91_edges')
    os.makedirs(out, exist_ok=True)
    img = load(src)
    seed = sum(map(ord, tail))
    ea, line = edge_alpha(seed)
    ca, r0, r = corner_alpha(seed)
    fe = fc = None
    if '--foam' in a:
        yy = np.arange(PX)[:, None].astype(np.float32)
        fe = foam(yy - line[None, :])
        fc = foam(r - r0)
    for name, al, fb in (('edge', ea, fe), ('corner', ca, fc)):
        p = os.path.join(out, 'forest_%s_%s.webp' % (name, tail))
        compose(img, al, fb).save(p, 'WEBP', quality=90, method=6)
        print('EDGE_TILE', p)
    # 좌우 이음 검사(변): 왼쪽 끝 열과 오른쪽 끝 열 알파 차
    print('SEAM_X %.3f' % float(np.abs(ea[:, 0] - ea[:, -1]).mean()))


if __name__ == '__main__':
    main()
