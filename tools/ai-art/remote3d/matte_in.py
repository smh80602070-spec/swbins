"""K-0180 — 눈으로 고른 몸 그림을 TRELLIS 입력(투명 RGBA 768 + license)으로: u2net 물체 마스크 → 가장 큰 덩어리만(떨어진 반짝이·거품 지움).
  py tools/ai-art/remote3d/matte_in.py <eye_pick.json> <그림 폴더> --dest <입력 폴더>
eye_pick.json = {"<몸 id>": "<후보 파일 이름(확장자 없음)>"} · 결과 <dest>/<몸 id>.png + .license.json(후보 license 그대로).
K-0145 때 손으로 하던 "u2net matte + 큰 덩어리만" 과 같은 일.
  --holes : 몸에 둘러싸인 바탕(꼬리 고리 안 등 — u2net 이 몸으로 침) 도 지운다 = 모서리 바탕색과 가까운(±10) 덩어리 중 그림의 0.5% 넘는 것(K-0180 finback_brute).
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from seg_mask import object_mask  # noqa: E402


def labels(m):
    """4-이웃 덩어리 번호(scipy 없이 — 줄 단위 BFS) → (번호 판, {번호: 크기})."""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    size, cur = {}, 0
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        cur += 1
        st = [(y0, x0)]
        lab[y0, x0] = cur
        n = 0
        while st:
            y, x = st.pop()
            n += 1
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur
                    st.append((yy, xx))
        size[cur] = n
    return lab, size


def holes(im, keep):
    """몸 안쪽에 남은 바탕색 덩어리(그림의 0.5% 넘는 것)를 True 로."""
    a = np.asarray(im, np.int16)
    h, w = keep.shape
    bg = np.median(np.array([a[4, 4], a[4, w - 5], a[h - 5, 4], a[h - 5, w - 5]]), axis=0)
    near = (np.abs(a - bg).max(axis=2) <= 10) & keep
    lab, size = labels(near)
    big = [k for k, n in size.items() if n > h * w * 0.005]
    return np.isin(lab, big)


def biggest(m):
    """4-이웃 덩어리 중 가장 큰 것만 남긴다(scipy 없이 — 줄 단위 BFS)."""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        cur += 1
        st = [(y0, x0)]
        lab[y0, x0] = cur
        n = 0
        while st:
            y, x = st.pop()
            n += 1
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur
                    st.append((yy, xx))
        if n > best_n:
            best, best_n = cur, n
    return lab == best


def main():
    a = sys.argv[1:]
    picks = json.load(open(a[0], encoding='utf-8'))
    src = a[1]
    dest = a[a.index('--dest') + 1]
    do_holes = '--holes' in a
    os.makedirs(dest, exist_ok=True)
    for bid, cand in picks.items():
        im = Image.open(os.path.join(src, cand + '.png')).convert('RGB')
        m = object_mask(im)
        keep = biggest(m > 0.5)
        if do_holes:
            hl = holes(im, keep)
            keep &= ~hl
            print('HOLES', bid, '%.3f' % hl.mean())
        al = np.where(keep, m, 0) * 255
        out = im.convert('RGBA')
        out.putalpha(Image.fromarray(al.astype(np.uint8)))
        out.save(os.path.join(dest, bid + '.png'))
        lj = os.path.join(src, cand + '.license.json')
        if os.path.exists(lj):
            shutil.copyfile(lj, os.path.join(dest, bid + '.license.json'))
        print('MATTE', bid, cand, 'cover %.2f' % keep.mean())


if __name__ == '__main__':
    main()
