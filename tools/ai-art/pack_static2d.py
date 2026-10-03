"""K-0056 단계 2·4 — AI 가 그린 2D 정적 지물(static2d)을 웹 규격으로 포장한다: 흰 배경 제거(알파) → 256px 알파 한 장 → <id>.webp + <id>.license.json.
  py tools/ai-art/pack_static2d.py [<원본폴더>] [<출력폴더>]      기본 _out/static2d → _out/static2d_pack
규격(웹 shared/js/mode2d.js): 256px 정사각, 발 밑이 아래 가운데(바닥 4px 위), 가로 대칭 여백, 투명 배경. 크기 비율은 웹 설정(prop2d h)이 정하므로 물체를 칸 가득(최대 변 240px)에 맞춘다.
검사: 알맹이 비율 6~80% · 투명 비율 ≥ 20% · 가장자리 흰 테 없음. 실패는 report.json 에 이유와 함께.
출력: <id>.webp · <id>.license.json(gen.py 기록 + 포장 정보) · sheet.jpg(확인용) · report.json
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icon_pack as IP  # noqa: E402  (matte·check 재사용)

S = 256


TINT = {'future_dome_01', 'tree_birch_01', 'tree_pine_01_snow'}        # make_static2d_batch.TINT_BG — 색 배경(흰 물체)
WIDE_HOLES = {'iron_fence_01': 9000, 'wood_fence_01': 9000}              # 큰 구멍을 지워야 하는 울타리류


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


HERE = os.path.dirname(os.path.abspath(__file__))
a = [x for x in sys.argv[1:] if not x.startswith('--')]
src = os.path.abspath(a[0]) if a else os.path.join(HERE, '_out', 'static2d')
out = os.path.abspath(a[1]) if len(a) > 1 else os.path.join(HERE, '_out', 'static2d_pack')
os.makedirs(out, exist_ok=True)
report, cells = {}, []
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'):
        continue
    iid = f[:-4]
    im = matte2(Image.open(os.path.join(src, f)), tol=26, holes_max=0, strip=False) if iid in TINT else matte2(Image.open(os.path.join(src, f)), tol=9, holes_max=WIDE_HOLES.get(iid, 7000))
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not bb:
        report[iid] = {'ok': False, 'why': ['알맹이를 못 땄다']}
        continue
    c = im.crop(bb)
    k = 240 / max(c.size)
    c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cv.alpha_composite(c, ((S - c.width) // 2, S - 4 - c.height))        # 발 밑 = 아래 가운데
    rep = IP.check(cv)
    rep['fill'] = round(c.height / S, 2)
    report[iid] = rep
    cv.save(os.path.join(out, iid + '.webp'), 'WEBP', quality=88, method=6)
    lp = os.path.join(src, iid + '.license.json')
    lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {'id': iid}
    lic.update({'id': iid, 'packed_by': 'tools/ai-art/pack_static2d.py', 'size': [S, S], 'check': {k2: rep[k2] for k2 in ('cover', 'transparent', 'white_edge', 'ok')}})
    json.dump(lic, open(os.path.join(out, iid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cells.append((iid, cv, rep['ok']))
cols = 6
rows = (len(cells) + cols - 1) // cols
cw = 200
sheet = Image.new('RGB', (cols * cw, rows * (cw + 16)), (205, 222, 196))
d = ImageDraw.Draw(sheet)
for i, (iid, cv, ok) in enumerate(cells):
    x, y = (i % cols) * cw, (i // cols) * (cw + 16)
    t = cv.resize((cw, cw), Image.LANCZOS)
    sheet.paste(t, (x, y + 16), t)
    d.text((x + 4, y + 2), iid + ('' if ok else ' !'), fill=(20, 30, 20) if ok else (200, 30, 30))
sheet.save(os.path.join(out, 'sheet.jpg'), quality=90)
json.dump(report, open(os.path.join(out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = [k for k, v in report.items() if not v.get('ok')]
print('포장 %d개 · 검사 실패 %d %s' % (len(cells), len(bad), bad))
