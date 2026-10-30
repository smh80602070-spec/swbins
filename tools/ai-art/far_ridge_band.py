"""K-0193 — 1만리 3D 먼 산 띠(GPU·SD 안 씀). 결·대기 원근이 있는 4겹 산맥 파노라마 한 장, 좌우 이음매 없음.

  py tools/ai-art/far_ridge_band.py [--out <폴더>]
      → <out>/ridge_go_band.webp (2048×256 RGBA, 위 투명 · 아래는 지평선 안개색으로 풀려 땅과 맞닿음) + ridge_go_band.license.json
        기본 out = saga-assets/sky (place 항목 `sky` 가 웹·고돗으로 복사)

산 능선 = 정수 주파수 사인 합(날카로운 봉우리용 1-|sin|) 이라 가로 2048 에서 정확히 한 바퀴 — 이음이 원리적으로 없다.
겹마다 멀수록 안개색(HZ)에 가깝고 낮고 흐리다. 빛은 왼쪽 위: 능선 기울기로 한쪽 면을 밝게. 먼 두 겹 높은 봉우리엔 눈.
숲결·바위결은 정수 주파수 줄무늬. 원작·작가 이름 없음, 외부 입력 없음(CC0).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

W, H = 2048, 256
HZ = np.array([178.0, 198.0, 214.0], np.float32)        # 지평선 안개색
NEAR = np.array([76.0, 112.0, 92.0], np.float32)         # 가장 가까운 산 색(초록 쪽)
FAR = np.array([142.0, 164.0, 190.0], np.float32)        # 가장 먼 산 색(푸른 쪽)
SNOW = np.array([238.0, 242.0, 248.0], np.float32)
# 겹: (씨앗, 능선 아래 기준선 y, 높이 진폭 px, 안개 섞임, 눈 문턱 또는 None)
LAYERS = [
    (101, 150, 96, 0.78, 0.88),
    (202, 176, 84, 0.58, 0.93),
    (303, 202, 70, 0.34, None),
    (404, 226, 52, 0.14, None),
]


def ridge_profile(seed):
    """0~1 능선 높이(주기 W) — 날카로운 봉우리(1-|sin|) 여섯 항."""
    rng = np.random.default_rng(seed)
    x = np.arange(W, dtype=np.float32)
    r = np.zeros(W, np.float32)
    for f, a in ((3, 1.0), (5, 0.8), (9, 0.55), (17, 0.38), (31, 0.22), (57, 0.12)):
        r += a * (1 - np.abs(np.sin(2 * np.pi * f * x / W + rng.uniform(0, 6.28))))
    r = (r - r.min()) / (r.max() - r.min())
    return r


def stripes(seed, fx_list, fy_list):
    """정수 주파수 줄무늬 잡음 0~1 (x 로 주기 W)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = np.zeros((H, W), np.float32)
    for fx, fy in zip(fx_list, fy_list):
        n += np.sin(2 * np.pi * (fx * xx / W + fy * yy / H) + rng.uniform(0, 6.28))
    n = (n - n.min()) / (n.max() - n.min())
    return n


def build():
    yy = np.arange(H, dtype=np.float32)[:, None]
    out = np.zeros((H, W, 3), np.float32)
    alpha = np.zeros((H, W), np.float32)
    dx = np.arange(W, dtype=np.float32)
    for i, (seed, base, amp, haze, snow_t) in enumerate(LAYERS):
        r = ridge_profile(seed)
        top = base - amp * r                                                   # 능선 y(작을수록 위)
        slope = np.roll(r, -2) - np.roll(r, 2)                                  # 기울기 → 왼쪽 위 빛
        slope = slope / (np.abs(slope).max() + 1e-6)
        mask = np.clip(yy - top[None, :] + 0.5, 0, 1)                           # 능선 아래 1, 안티앨리어싱 1px
        t = i / (len(LAYERS) - 1)
        base_col = FAR * (1 - t) + NEAR * t
        col = base_col * (1 - haze) + HZ * haze
        depth = np.clip((yy - top[None, :]) / (amp + 40), 0, 1)                 # 능선에서 아래로
        rgb = np.broadcast_to(col, (H, W, 3)).copy()
        rgb = rgb * (1.0 + 0.16 * (slope[None, :, None] * -1.0) * (1 - depth[..., None]))   # 빛받이
        rgb = rgb * (1 - 0.10 * depth[..., None]) + HZ * 0.10 * depth[..., None]            # 아래로 갈수록 안개
        tex = stripes(seed + 7, (11, 19, 29, 43), (7, 11, 5, 13))
        rgb = rgb * (1 + (tex[..., None] - 0.5) * (0.08 * (1 - haze) + 0.03))                # 숲·바위 결
        if snow_t is not None:
            cap = np.clip((r - snow_t) * 10, 0, 1)[None, :] * np.clip(1 - depth * 3.2, 0, 1)
            cap = cap * (0.65 + 0.35 * tex)
            rgb = rgb * (1 - cap[..., None]) + SNOW * cap[..., None]
        out = out * (1 - mask[..., None]) + rgb * mask[..., None]
        alpha = np.maximum(alpha, mask)
    fade = np.clip((yy - (H - 70)) / 70.0, 0, 1)                                # 아래 70px 는 안개색으로 풀려 땅과 맞닿음
    out = out * (1 - fade[..., None]) + HZ * fade[..., None]
    alpha = np.maximum(alpha, fade[:, :1].repeat(W, 1))
    rgba = np.dstack([np.clip(out, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def main(argv):
    out = os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')), 'saga-assets', 'sky')
    if '--out' in argv:
        out = argv[argv.index('--out') + 1]
    os.makedirs(out, exist_ok=True)
    im = build()
    p = os.path.join(out, 'ridge_go_band.webp')
    im.save(p, 'WEBP', lossless=True, method=6)
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    wrap = np.abs(a[:, 0] - a[:, -1]).mean()
    inner = np.abs(a[:, 1:] - a[:, :-1]).mean()
    lic = {'id': 'ridge_go_band', 'generator': 'tools/ai-art/far_ridge_band.py', 'model': '', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
           'derived': '정수 주파수 사인 합 능선 4겹 + 줄무늬 결 + 안개색 섞임 — 가로 2048 주기 이음매 없음', 'note': '1만리 3D 먼 산 띠(K-0193)',
           'px': [W, H], 'date': '2026-10-30', 'ticket': 'K-0193'}
    json.dump(lic, open(os.path.join(out, 'ridge_go_band.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('RIDGE', p, 'wrap/inner = %.2f' % (wrap / max(inner, 1e-6)), os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:])
