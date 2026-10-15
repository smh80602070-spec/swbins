"""K-0056 단계 3·4 — AI 가 그린 정면·옆·뒤 정지 그림(moving2d)을 웹 규격으로 포장: 배경 제거 → 256px 알파 → <캐릭터>/<front|side|back>.webp + manifest.json + license.
  py tools/ai-art/pack_moving2d.py [<원본폴더>] [<출력폴더>] [--heads]      기본 _out/moving2d → _out/moving2d_pack · --heads 는 등신 재기(K-0112, 끝 줄 HEADS_OK|HEADS_LOW)
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
HEADS = '--heads' in sys.argv   # K-0112: 알파 실루엣으로 등신을 잰다(report.json heads · sheet.jpg 등신 수·1/8 눈금 노랑·목 빨강)


def heads_of(im):
    """알파 실루엣 → (등신, 머리 꼭대기 비율, 목 비율). 머리 꼭대기 = 몸통 너비의 25% 넘는 첫 줄(창끝·모자 끝 제외),
    목 = 몸 높이 8~30% 사이에서 위에 더 넓은 줄(머리)이 있는 가장 좁은 줄. 등신 ≈ 몸 높이 / 목 높이."""
    al = np.asarray(im.getchannel('A')) > 24
    h = al.shape[0]
    run = np.zeros(h)
    for y in range(h):   # 줄마다 가장 긴 연속 구간 — 창대·활처럼 몸과 떨어진 가는 것은 셈에서 빠진다
        r = al[y]
        if r.any():
            e = np.flatnonzero(np.diff(np.r_[0, r.astype(np.int8), 0]))
            run[y] = (e[1::2] - e[::2]).max()
    w = ndimage.uniform_filter1d(run, max(3, h // 150))
    rows = np.nonzero(w > 0)[0]
    if len(rows) < 20:
        return 0.0, 0.0, 0.0
    y0, y1 = rows[0], rows[-1] + 1
    torso = np.median(w[y0 + int(0.30 * (y1 - y0)):y0 + int(0.60 * (y1 - y0))])
    top = y0 + int(np.argmax(w[y0:y1] >= 0.15 * torso))
    H = y1 - top
    best, neck = None, 0
    lo, hi, dn = top + int(0.08 * H), top + int(0.30 * H), max(2, int(0.12 * H))
    for y in range(lo, hi):   # 목 = 위(머리)보다 12% 좁고 아래(어깨, 몸 높이 12% 안)가 30% 넓은 줄 중 가장 좁은 줄
        hw = w[top:y].max()   # 머리 높이는 머리 너비의 0.8 배 이상(투구 깃·머리칼 안쪽 잘록한 곳을 목으로 안 본다)
        if hw > 1.12 * w[y] and y - top >= 0.8 * hw and w[y:y + dn].max() > 1.3 * w[y] and (best is None or w[y] < best):
            best, neck = w[y], y
    if not neck:   # 투구·두건·수염으로 목이 안 보이면: 어깨가 가장 가파르게 넓어지는 줄의 바로 위
        dw = np.diff(w[lo:hi + 1])
        neck = lo + int(np.argmax(dw)) if len(dw) else 0
    if neck <= top:
        return 0.0, top / h, 0.0
    return H / (neck - top), top / h, neck / h
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
        if os.environ.get('MATTE_BGHOLES'):   # K-0112: 다리·팔 사이에 갇힌 배경색 틈 — 위 두 모서리 배경색과 가까운(≤ 값) 덩어리가 그림의 0.15% 넘으면 지운다
            src_rgb = np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(np.int16)
            hh, ww = src_rgb.shape[:2]
            corners = np.concatenate([src_rgb[:12, :12].reshape(-1, 3), src_rgb[:12, -12:].reshape(-1, 3)])
            bgc = np.median(corners, axis=0)
            cand = (np.abs(src_rgb - bgc).max(axis=2) <= int(os.environ.get('MATTE_BGHOLES'))) & (np.asarray(im.getchannel('A')) > 0)
            lab3, n3 = ndimage.label(cand)
            if n3:
                sizes3 = ndimage.sum(np.ones_like(lab3), lab3, range(1, n3 + 1))
                big = [i + 1 for i, z in enumerate(sizes3) if z >= 0.0015 * hh * ww]
                alpha0 = np.asarray(im.getchannel('A')).astype(np.uint8).copy()
                alpha0[np.isin(lab3, big)] = 0
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
        hd = heads_of(c) if HEADS else None
        c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
        cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        cv.alpha_composite(c, ((S - c.width) // 2, S - 4 - c.height))
        rep = IP.check(cv)
        if hd:
            rep['heads'] = round(hd[0], 2)
            oy = S - 4 - c.height
            rep['heads_rows'] = [round(oy + hd[1] * c.height), round(oy + hd[2] * c.height), S - 4]   # 머리 꼭대기·목·발(256 칸 기준)
        report[f'{cid}_{v}'] = rep
        oks.append(rep['ok'])
        if v == 'front' or (v == 'side' and not body):
            body = c.height
        cv.save(os.path.join(out, cid, v + '.webp'), 'WEBP', quality=88, method=6)
        rows.append((f'{cid}_{v}', cv, rep['ok'], rep.get('heads'), rep.get('heads_rows')))
        lp = os.path.join(src, f'{cid}_{v}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {'id': f'{cid}_{v}'}
        lic.update({'id': f'{cid}_{v}', 'packed_by': 'tools/ai-art/pack_moving2d.py', 'size': [S, S]})
        json.dump(lic, open(os.path.join(out, cid, v + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    man = {'id': cid, 'kind': 'still3', 'px': S, 'views': sorted(cut, key=['front', 'side', 'back'].index), 'body_px': body,
           'note': '방식 A — 정면·옆·뒤 정지 그림, 걸음·숨쉬기는 웹 코드(mode2d 한 장 모드). 반대 옆은 side 를 좌우 뒤집어 쓴다.'}
    json.dump(man, open(os.path.join(out, cid, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
cols, cw = (6, 240) if HEADS else (6, 200)
sheet = Image.new('RGB', (cols * cw, ((len(rows) + cols - 1) // cols) * (cw + 14)), (60, 66, 78))
d = ImageDraw.Draw(sheet)
for i, (iid, cv, ok, hn, hr) in enumerate(rows):
    x, y = (i % cols) * cw, (i // cols) * (cw + 14)
    t = cv.resize((cw, cw), Image.LANCZOS)
    if hr:   # 1/8 눈금(노랑, 머리 꼭대기~발 8칸)·목(빨강)
        g = cw / S
        for k8 in range(9):
            yy = y + 14 + (hr[0] + (hr[2] - hr[0]) * k8 / 8) * g
            d.line([(x, yy), (x + cw - 1, yy)], fill=(200, 180, 60))
        d.line([(x, y + 14 + hr[1] * g), (x + cw - 1, y + 14 + hr[1] * g)], fill=(230, 70, 70))
    sheet.paste(t, (x, y + 14), t)
    good = ok and (not HEADS or (hn or 0) >= 7.5)
    d.text((x + 3, y), iid + (f' {hn:.1f}' if hn else '') + ('' if ok else ' !'), fill=(255, 255, 255) if good else (255, 130, 130))
sheet.save(os.path.join(out, 'sheet.jpg'), quality=90)
json.dump(report, open(os.path.join(out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = [k2 for k2, v in report.items() if not v.get('ok')]
print('캐릭터 %d · 그림 %d · 검사 실패 %d %s' % (len(chars), len(rows), len(bad), bad))
if HEADS:
    low = 0
    for cid in chars:
        hs = {v: report[f'{cid}_{v}'].get('heads', 0) for v in ('front', 'side', 'back') if f'{cid}_{v}' in report}
        m = min(hs.values()) if hs else 0
        low += m < 7.5
        print('HEADS %-18s %s  최소 %.2f %s' % (cid, ' '.join(f'{v} {x:.2f}' for v, x in hs.items()), m, '○' if m >= 7.5 else '✗'))
    print('HEADS_OK' if not low else f'HEADS_LOW {low}/{len(chars)}')
