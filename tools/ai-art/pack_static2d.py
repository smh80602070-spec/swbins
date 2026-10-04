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


from matte_util import matte2  # noqa: E402

TINT = {'future_dome_01', 'tree_birch_01', 'tree_pine_01_snow'}        # make_static2d_batch.TINT_BG — 색 배경(흰 물체)
WIDE_HOLES = {'iron_fence_01': 9000, 'wood_fence_01': 9000}              # 큰 구멍을 지워야 하는 울타리류

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
    if iid.startswith('wpn_') and not rep.get('ok', True):                                          # 길고 가는 무기(창·지팡이·활)는 알맹이 비율이 작은 게 정상
        rep['why'] = [w for w in rep.get('why', []) if '너무 작음' not in w]
        rep['ok'] = not rep['why']
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
