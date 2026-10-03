"""K-0056 단계 4 점검 — 2D 정적 지물·움직이는 것(still3) 포장 결과를 세고 판정 시트를 만든다.

  py tools/ai-art/check_still2d.py [--static <폴더>] [--moving <폴더>] [--sheet]
기본 --static _out/static2d_pack6 · --moving _out/moving2d_pack
점검: .webp 마다 .license.json · 256px 알파 · 알맹이 비율·바닥 4px 위 발 밑 · 정적 id 가 정본(saga-assets/world/sprite)에 있나 · 판당 용량.
      움직이는 것: 폴더마다 front·side·back(물고기는 side 만) + manifest.json.
--sheet : _out/still2d_sheet_static.jpg(새·옛 나란히) · _out/still2d_sheet_moving.jpg(세 방향) 를 만든다(사용자 판정용).
끝 줄 STILL2D_OK/STILL2D_FAIL, 종료 0/1.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OLD = os.path.join(ROOT, 'saga-assets', 'world', 'sprite')
FAIL = []


def arg(name, default):
    return os.path.abspath(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


static = arg('--static', os.path.join(HERE, '_out', 'static2d_pack6'))
moving = arg('--moving', os.path.join(HERE, '_out', 'moving2d_pack'))


def check_img(p, tag):
    if not os.path.exists(p[:-5] + '.license.json'):
        FAIL.append(f'{tag}: license 없음')
    im = Image.open(p).convert('RGBA')
    if im.size != (256, 256):
        FAIL.append(f'{tag}: 크기 {im.size}')
        return None
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.where(a > 24)
    if not len(ys):
        FAIL.append(f'{tag}: 알맹이 없음')
        return None
    cover = float((a > 24).mean())
    foot = 255 - int(ys.max())
    if not 0.04 <= cover <= 0.8:
        FAIL.append(f'{tag}: 알맹이 비율 {cover:.2f}')
    if foot > 8:
        FAIL.append(f'{tag}: 발 밑이 떠 있음({foot}px)')
    return im


def main():
    st = sorted(f for f in os.listdir(static) if f.endswith('.webp'))
    new_ids = []
    for f in st:
        if check_img(os.path.join(static, f), f) is not None:
            new_ids.append(f[:-5])
    miss = [i for i in new_ids if not os.path.exists(os.path.join(OLD, i + '.webp'))]
    kb = sum(os.path.getsize(os.path.join(static, f)) for f in st) / 1024
    print(f'정적 {len(st)}장 · 정본에 없는 id {len(miss)} {miss[:6]} · {kb:.0f}KB')
    if kb > 6144:
        FAIL.append('정적 용량 6MB 초과')

    folders = sorted(d for d in os.listdir(moving) if os.path.isdir(os.path.join(moving, d)))
    mv = {}
    for d in folders:
        dd = os.path.join(moving, d)
        if not os.path.exists(os.path.join(dd, 'manifest.json')):
            FAIL.append(f'{d}: manifest 없음')
        views = json.load(open(os.path.join(dd, 'manifest.json'), encoding='utf-8')).get('views', []) if os.path.exists(os.path.join(dd, 'manifest.json')) else []
        mv[d] = {}
        for v in views:
            p = os.path.join(dd, v + '.webp')
            if not os.path.exists(p):
                FAIL.append(f'{d}/{v}: 그림 없음')
                continue
            mv[d][v] = check_img(p, f'{d}/{v}')
    n = sum(len(v) for v in mv.values())
    mkb = sum(os.path.getsize(os.path.join(dp, f)) for dp, _d, fs in os.walk(moving) for f in fs) / 1024
    print(f'움직이는 것 {len(folders)}종 · 그림 {n}장 · {mkb:.0f}KB')

    if '--sheet' in sys.argv:
        sheet_static(new_ids)
        sheet_moving(mv)
    print('STILL2D_FAIL' if FAIL else 'STILL2D_OK')
    for m in FAIL:
        print(' -', m)
    return 1 if FAIL else 0


def tile(im, size, bg):
    cv = Image.new('RGB', (size, size), bg)
    if im is not None:
        t = im.resize((size, size), Image.LANCZOS)
        cv.paste(t, (0, 0), t)
    return cv


def sheet_static(ids):
    S, cols = 120, 8
    rows = (len(ids) + cols - 1) // cols
    W = cols * (S * 2 + 8) + 8
    out = Image.new('RGB', (W, rows * (S + 22) + 8), (60, 70, 60))
    d = ImageDraw.Draw(out)
    for i, iid in enumerate(ids):
        x, y = 8 + (i % cols) * (S * 2 + 8), 8 + (i // cols) * (S + 22)
        old = Image.open(os.path.join(OLD, iid + '.webp')).convert('RGBA') if os.path.exists(os.path.join(OLD, iid + '.webp')) else None
        out.paste(tile(old, S, (110, 130, 100)), (x, y))
        out.paste(tile(Image.open(os.path.join(static, iid + '.webp')).convert('RGBA'), S, (110, 130, 100)), (x + S, y))
        d.text((x, y + S + 4), iid[:30], fill=(255, 255, 255))
    p = os.path.join(HERE, '_out', 'still2d_sheet_static.jpg')
    out.save(p, quality=85)
    print('시트', p, '(왼 옛 · 오른 새)')


def sheet_moving(mv):
    S = 128
    names = sorted(mv)
    out = Image.new('RGB', (3 * S * 2 + 20, len(names) * (S + 6) // 2 + 20), (60, 70, 60))
    d = ImageDraw.Draw(out)
    for i, nm in enumerate(names):
        x, y = 8 + (i % 2) * (3 * S + 4), 8 + (i // 2) * (S + 6)
        for j, v in enumerate(('front', 'side', 'back')):
            out.paste(tile(mv[nm].get(v), S, (110, 130, 100)), (x + j * S, y))
        d.text((x + 2, y + 2), nm, fill=(255, 255, 0))
    p = os.path.join(HERE, '_out', 'still2d_sheet_moving.jpg')
    out.save(p, quality=85)
    print('시트', p)


sys.exit(main())
