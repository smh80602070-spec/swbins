"""K-0193 — 4종횡 발판 후보(단색 파스텔 배경 위 한 물체)의 배경 제거 + 높이 128px 로 맞춘 투명 PNG.

  py tools/ai-art/plat_cut.py <입력.webp|png> [...] [--out <폴더>] [--tol 26] [--grow 6]
      → <out>/<이름>.png (RGBA, 높이 128, 가로는 비율대로) + 같은 이름 .license.json(입력 출처 이어받음)

방법: 네 모서리 색을 배경 기준으로 삼아 가장자리에서 이어진 '배경색과 가까운' 픽셀을 지운다(가까운 이웃끼리 ≤ grow 씩 변해도 이어짐 — 그라데이션 배경).
가장자리 1~2px 는 배경색 섞임을 줄이려고 반투명으로 깎는다. 가장 큰 연결 덩어리만 남긴다(떠다니는 얼룩 제거).
scipy 없이 numpy 만 쓴다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def cut(im, tol=26, grow=6):
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    h, w, _ = rgb.shape
    corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]).astype(np.int16)
    ref = corners.mean(0)
    bg = np.zeros((h, w), bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            stack.append((y, x))
    seen = np.zeros((h, w), bool)
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x]:
            continue
        seen[y, x] = True
        c = rgb[y, x]
        near_ref = np.abs(c - ref).max() <= tol * 1.6
        near_corner = np.abs(corners - c).max(1).min() <= tol
        if not (near_ref or near_corner):
            continue
        bg[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and np.abs(rgb[ny, nx] - c).max() <= grow:
                stack.append((ny, nx))
            elif 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and (np.abs(rgb[ny, nx] - ref).max() <= tol * 1.6):
                stack.append((ny, nx))
    fg = ~bg
    # 가장 큰 연결 덩어리만
    lab = np.zeros((h, w), np.int32)
    n = 0
    best, best_n = 0, 0
    for y0 in range(h):
        for x0 in range(w):
            if fg[y0, x0] and lab[y0, x0] == 0:
                n += 1
                st = [(y0, x0)]
                lab[y0, x0] = n
                cnt = 0
                while st:
                    y, x = st.pop()
                    cnt += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n
                            st.append((ny, nx))
                if cnt > best_n:
                    best, best_n = n, cnt
    fg = lab == best
    a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(a)
    return out.crop(out.getbbox())


def main(argv):
    out = os.path.join('saga-assets', 'web2d', 'side-cand', 'plat_cut')
    tol, grow = 26, 6
    files = []
    i = 0
    while i < len(argv):
        if argv[i] == '--out':
            out = argv[i + 1]
            i += 2
        elif argv[i] == '--tol':
            tol = int(argv[i + 1])
            i += 2
        elif argv[i] == '--grow':
            grow = int(argv[i + 1])
            i += 2
        else:
            files.append(argv[i])
            i += 1
    os.makedirs(out, exist_ok=True)
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        im = cut(Image.open(f), tol, grow)
        for _ in range(2):                       # 둥근 판처럼 모서리 색과 다른 바탕이 남으면(상자의 85% 이상 차지) 가운데 가장자리 색을 기준으로 한 번 더
            al = np.asarray(im.getchannel('A'))
            if (al > 128).mean() < 0.85:
                break
            rgb = np.asarray(im.convert('RGB')).copy()
            ref = tuple(int(v) for v in rgb[rgb.shape[0] // 2, 3])
            rgb[al < 128] = ref
            rgb[0, 0] = rgb[0, -1] = rgb[-1, 0] = rgb[-1, -1] = ref
            again = cut(Image.fromarray(rgb), tol, grow)
            if again.width * again.height < 0.2 * im.width * im.height:
                break
            im = again
        hgt = 128
        im = im.resize((max(1, round(im.width * hgt / im.height)), hgt), Image.LANCZOS)
        im.save(os.path.join(out, name + '.png'))
        src_lic = os.path.splitext(f)[0] + '.license.json'
        lic = json.load(open(src_lic, encoding='utf-8')) if os.path.exists(src_lic) else {}
        lic['note'] = 'K-0193 4종횡 발판 후보 배경 제거(plat_cut.py tol=%d grow=%d) 높이 128' % (tol, grow)
        json.dump(lic, open(os.path.join(out, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('PLATCUT', name, im.size)


if __name__ == '__main__':
    main(sys.argv[1:])
