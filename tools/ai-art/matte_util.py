"""2D 그림 후처리 공용 — 흰(또는 단색) 배경 제거(matte2). pack_static2d.py·pack_moving2d.py 가 쓴다(K-0056).
matte2(img, tol, holes_max, strip): ① 가장자리에서 이어진 배경색(icon_pack.matte) ② 안쪽 막힌 순백 구멍(≤ holes_max px) ③ 가장자리 흰 띠 벗기기·색 번짐 채움.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icon_pack as IP  # noqa: E402


def matte2(img, tol=22, holes_max=7000, strip=True):
    """흰 배경 제거 2단계 — ① 가장자리에서 이어진 흰색(icon_pack.matte) ② 안쪽에 막힌 순백 구멍(울타리 살 사이·밧줄 사이) ③ 가장자리 1px 깎고
    반투명 띠의 색을 안쪽 불투명 색으로 채운다(흰 번짐 제거). 눈 덮인 소나무·돛처럼 '흰색에 가까운 물체'는 순백(전 채널 ≥ 246)만 지워서 남는다."""
    im = IP.matte(img, tol)
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    al = np.asarray(im.getchannel('A')).astype(np.float32)
    pure = (rgb.min(axis=2) >= 246) & (al > 0)
    # 안쪽 순백 구멍: 연결 성분 크기 40~7000 이면 지운다(울타리 살 사이 같은 좁은 틈만 — 돔 지붕·자작 수관 같은 큰 흰 면은 물체라 남긴다)
    h, w = pure.shape
    seen = np.zeros_like(pure)
    for y0 in range(h):
        for x0 in range(w):
            if pure[y0, x0] and not seen[y0, x0]:
                stack, comp = [(y0, x0)], []
                seen[y0, x0] = True
                while stack:
                    y, x = stack.pop()
                    comp.append((y, x))
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < h and 0 <= xx < w and pure[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            stack.append((yy, xx))
                if 40 <= len(comp) <= holes_max:
                    for y, x in comp:
                        al[y, x] = 0
    # 가장자리 흰 띠 벗기기: 투명과 맞닿은 픽셀이 순백에 가까운(전 채널 ≥ 238, 채도 거의 없음) 흰 선이면 지운다. 4번 반복. 배경 판정 tol 9 — 흰색에 가까운 물체(돔·자작 수관)를 배경과 같이 지우지 않게(AI 가 윤곽 밖에 그린 흰 선 1~3px)
    for _ in range(4 if strip else 0):
        opaque = (al > 0).astype(np.uint8) * 255
        inner = np.asarray(Image.fromarray(opaque).filter(ImageFilter.MinFilter(3)))
        border = (opaque > 0) & (inner == 0)
        al[border & (rgb.min(axis=2) >= 238) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 14)] = 0
    a_img = Image.fromarray(al.astype(np.uint8))
    a_img = a_img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))      # 1px 깎고 부드럽게
    al2 = np.asarray(a_img).astype(np.float32) / 255
    # 색 채우기: 불투명(≥0.95) 픽셀의 색을 바깥 3칸까지 번지게 해서, 반투명 띠가 흰색 대신 안쪽 색을 갖게 한다
    col = rgb.astype(np.float32)
    solid = (al2 >= 0.95).astype(np.float32)
    for _ in range(3):
        num = np.zeros_like(col)
        den = np.zeros((h, w), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sc = np.roll(np.roll(col * solid[..., None], dy, 0), dx, 1)
            sm = np.roll(np.roll(solid, dy, 0), dx, 1)
            num += sc
            den += sm
        fill = (solid == 0) & (den > 0)
        col[fill] = num[fill] / den[fill][:, None]
        solid = np.where(fill, 1.0, solid)
    edge = (al2 < 0.95)
    out = np.asarray(im.convert('RGB')).astype(np.float32)
    out[edge] = col[edge]
    res = Image.fromarray(out.astype(np.uint8)).convert('RGBA')
    res.putalpha(Image.fromarray((al2 * 255).astype(np.uint8)))
    return res
