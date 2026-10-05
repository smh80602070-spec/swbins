"""K-0056 단계 3·4 — AI 가 그린 정면·옆·뒤 정지 그림(moving2d)을 웹 규격으로 포장: 배경 제거 → 256px 알파 → <캐릭터>/<front|side|back>.webp + manifest.json + license.
  py tools/ai-art/pack_moving2d.py [<원본폴더>] [<출력폴더>]      기본 _out/moving2d → _out/moving2d_pack
방식 A(한 장 모드): 웹 코드가 걸음(위아래 bob·기울임)·숨쉬기·좌우 뒤집기를 만든다. 반대 옆은 side 를 뒤집어 쓴다.
같은 캐릭터의 세 방향은 **한 배율**로 줄여서 몸 크기가 같게 하고(가장 큰 방향이 240px), 발 밑을 아래 가운데 4px 위에 놓는다.
manifest: {id, kind:'still3', px:256, views:[..], body_px(정면 몸 높이 px), license}. 검사: 알맹이 비율·투명 비율·가장자리 흰 테. report.json·sheet.jpg.
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matte_util import matte2  # noqa: E402
import icon_pack as IP  # noqa: E402

S = 256
HERE = os.path.dirname(os.path.abspath(__file__))
a = [x for x in sys.argv[1:] if not x.startswith('--')]
src = os.path.abspath(a[0]) if a else os.path.join(HERE, '_out', 'moving2d')
out = os.path.abspath(a[1]) if len(a) > 1 else os.path.join(HERE, '_out', 'moving2d_pack')
os.makedirs(out, exist_ok=True)
chars = {}
for f in sorted(os.listdir(src)):
    if f.endswith('.png'):
        cid, v = f[:-4].rsplit('_', 1)
        chars.setdefault(cid, {})[v] = f
report, rows = {}, []
for cid, views in chars.items():
    cut = {}
    for v, f in views.items():
        im = matte2(Image.open(os.path.join(src, f)), tol=int(os.environ.get('MATTE_TOL', 9)), holes_max=int(os.environ.get('MATTE_HOLES', 20000 if cid.startswith('beast') else 30000)))   # C 그림체(윤곽선 없는 연한 색): MATTE_HOLES=0 MATTE_TOL=20 — 몸 안쪽 흰 면을 구멍으로 안 지운다
        if os.environ.get('MATTE_FLOOR'):      # C 그림체: 바닥 띠 색이 위쪽 배경과 달라 남는다 → 아래 가장자리 색으로 한 번 더 바닥에서부터 지운다(넓고 납작한 것만)
            src_rgb = np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(np.int16)
            hh, ww = src_rgb.shape[:2]
            bbc = np.median(src_rgb[-6:].reshape(-1, 3), axis=0)
            cand = np.abs(src_rgb - bbc).max(axis=2) <= int(os.environ.get('MATTE_FLOOR'))
            lab2, n2 = ndimage.label(cand, structure=np.ones((3, 3)))
            alpha0 = np.asarray(im.getchannel('A')).astype(np.uint8)
            for i2 in set(lab2[-1][lab2[-1] > 0].tolist()):
                comp = lab2 == i2
                ys, xs = np.nonzero(comp)
                if comp.sum() >= 0.012 * hh * ww and (xs.max() - xs.min()) >= 0.25 * ww and (ys.max() - ys.min()) <= 0.35 * hh:
                    alpha0[comp] = 0
            im.putalpha(Image.fromarray(alpha0))
        # 떠 있는 작은 조각(화살 끝·먼지·점) 정리: 가장 큰 덩어리의 2% 미만인 덩어리는 지운다
        al = np.asarray(im.getchannel('A')).astype(np.uint8)
        lab, n = ndimage.label(al > 24, structure=np.ones((3, 3)))
        if n > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            keep = [i + 1 for i, z in enumerate(sizes) if z >= float(os.environ.get('MATTE_MINCOMP', 0.02)) * sizes.max()]
            al = np.where(np.isin(lab, keep), al, 0).astype(np.uint8)
            im.putalpha(Image.fromarray(al))
        if v == 'side' and cid in os.environ.get('FLIP_SIDE', '').split(','):   # side 는 오른쪽을 봐야 한다(mode2d dirOf 가 왼쪽일 때 뒤집음) — 왼쪽 보고 나온 그림만 좌우 반전
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        bb = im.getchannel('A').point(lambda x: 255 if x > 24 else 0).getbbox()
        if bb:
            cut[v] = im.crop(bb)
    if not cut:
        report[cid] = {'ok': False, 'why': ['알맹이를 못 땄다']}
        continue
    k = min(240 / max(c.size) for c in cut.values())            # 한 배율 — 가장 큰 방향이 칸에 꼭 맞는다
    os.makedirs(os.path.join(out, cid), exist_ok=True)
    oks, body = [], 0
    for v, c in cut.items():
        c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
        cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        cv.alpha_composite(c, ((S - c.width) // 2, S - 4 - c.height))
        rep = IP.check(cv)
        report[f'{cid}_{v}'] = rep
        oks.append(rep['ok'])
        if v == 'front' or (v == 'side' and not body):
            body = c.height
        cv.save(os.path.join(out, cid, v + '.webp'), 'WEBP', quality=88, method=6)
        rows.append((f'{cid}_{v}', cv, rep['ok']))
        lp = os.path.join(src, f'{cid}_{v}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {'id': f'{cid}_{v}'}
        lic.update({'id': f'{cid}_{v}', 'packed_by': 'tools/ai-art/pack_moving2d.py', 'size': [S, S]})
        json.dump(lic, open(os.path.join(out, cid, v + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    man = {'id': cid, 'kind': 'still3', 'px': S, 'views': sorted(cut, key=['front', 'side', 'back'].index), 'body_px': body,
           'note': '방식 A — 정면·옆·뒤 정지 그림, 걸음·숨쉬기는 웹 코드(mode2d 한 장 모드). 반대 옆은 side 를 좌우 뒤집어 쓴다.'}
    json.dump(man, open(os.path.join(out, cid, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
cols, cw = 6, 200
sheet = Image.new('RGB', (cols * cw, ((len(rows) + cols - 1) // cols) * (cw + 14)), (60, 66, 78))
d = ImageDraw.Draw(sheet)
for i, (iid, cv, ok) in enumerate(rows):
    x, y = (i % cols) * cw, (i // cols) * (cw + 14)
    t = cv.resize((cw, cw), Image.LANCZOS)
    sheet.paste(t, (x, y + 14), t)
    d.text((x + 3, y), iid + ('' if ok else ' !'), fill=(255, 255, 255) if ok else (255, 130, 130))
sheet.save(os.path.join(out, 'sheet.jpg'), quality=90)
json.dump(report, open(os.path.join(out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = [k2 for k2, v in report.items() if not v.get('ok')]
print('캐릭터 %d · 그림 %d · 검사 실패 %d %s' % (len(chars), len(rows), len(bad), bad))
