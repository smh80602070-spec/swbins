"""K-0196 ④ — 2나락 세트 문양 10(GPU·SD 안 씀). 세트 옷 칸·도감에 붙이는 작은 둥근 표식 32px(+64px).

  py tools/ai-art/setmark.py [--out <폴더>] [--sheet <PNG>]
      → <out>/<세트>_32.png · <세트>_64.png + <세트>.license.json  (기본 out = saga-assets/icons/setmark — 아이콘 place 항목이 안 가져가는 폴더)

세트 키·이름 = 웹 `saga-dungeon/js/data-set.js`(충무·와룡·호랑·청낭·철옹·은하·맹혼·비영·패왕·현학). 색 = 세트 성격대로 색상환에 나눈 지정색(PAL — 기존 세트 아이콘 대표색은
모두 올리브·녹색 계열이라 작은 표식에서 구분이 안 됨). 문양은 도형으로 그린다 — 방패·용 똬리·발톱 셋·주머니 십자·리벳 둥근 판·은하 소용돌이·불꽃·날개 셋·왕관·학 날개 —
384px 로 그려 32·64 로 줄인다. 원작 도안 없음, 외부 입력 없음(CC0).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
S = 384
C = S // 2
SETS = ['chungmu', 'waryong', 'horang', 'cheongnang', 'cheolong', 'eunha', 'maenghon', 'biyeong', 'paewang', 'hyeonhak']
NAME = {'chungmu': '충무', 'waryong': '와룡', 'horang': '호랑', 'cheongnang': '청낭', 'cheolong': '철옹',
        'eunha': '은하', 'maenghon': '맹혼', 'biyeong': '비영', 'paewang': '패왕', 'hyeonhak': '현학'}


PAL = {   # 세트 성격대로 색상환에 나눔 — 아이콘 대표색은 모두 올리브·녹색 계열이라 작은 표식에서 구분이 안 됨
    'chungmu': (196, 58, 50), 'waryong': (52, 128, 214), 'horang': (222, 132, 36), 'cheongnang': (64, 176, 92),
    'cheolong': (112, 134, 160), 'eunha': (138, 92, 214), 'maenghon': (210, 42, 84), 'biyeong': (48, 184, 200),
    'paewang': (222, 178, 40), 'hyeonhak': (96, 96, 112),
}


def main_color(key):
    if key in PAL:
        return PAL[key]
    p = os.path.join(ROOT, 'saga-assets', 'icons', 'icon128', 'set_%s_g3.png' % key)
    if not os.path.exists(p):
        p = os.path.join(ROOT, 'saga-assets', 'icons', 'content', 'set_%s.png' % key)
    a = np.asarray(Image.open(p).convert('RGBA'), np.float32)
    rgb, al = a[..., :3], a[..., 3]
    sat = rgb.max(-1) - rgb.min(-1)
    m = (al > 200) & (sat > 50)
    if m.sum() < 50:
        m = al > 200
    return tuple(int(v) for v in rgb[m].mean(0))


def lighten(c, k):
    return tuple(int(v + (255 - v) * k) for v in c)


def darken(c, k):
    return tuple(int(v * (1 - k)) for v in c)


def arc_pts(cx, cy, r, a0, a1, n=40):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def emblem(d, key, fg, W):
    """채움색 fg, 윤곽 W(굵기)."""
    if key == 'chungmu':                                   # 방패 + 별
        sh = [(C - 80, C - 90), (C + 80, C - 90), (C + 80, C + 10), (C, C + 100), (C - 80, C + 10)]
        d.polygon(sh, fill=fg)
        star = []
        for i in range(10):
            r = 52 if i % 2 == 0 else 22
            a = math.radians(-90 + i * 36)
            star.append((C + r * math.cos(a), C - 20 + r * math.sin(a)))
        d.polygon(star, fill=(30, 22, 18))
    elif key == 'waryong':                                 # 용 똬리(소용돌이) + 머리 점
        pts = []
        for i in range(160):
            t = i / 159
            a = t * 2.6 * 2 * math.pi
            r = 14 + 100 * t
            pts.append((C + r * math.cos(a), C + r * math.sin(a)))
        d.line(pts, fill=fg, width=W + 14, joint='curve')
        d.ellipse([pts[-1][0] - 20, pts[-1][1] - 20, pts[-1][0] + 20, pts[-1][1] + 20], fill=fg)
    elif key == 'horang':                                  # 발톱 자국 셋
        for k in (-62, 0, 62):
            d.polygon([(C + k - 14, C - 105), (C + k + 14, C - 105), (C + k + 40, C + 105), (C + k + 8, C + 90)], fill=fg)
    elif key == 'cheongnang':                              # 주머니 + 십자
        d.ellipse([C - 78, C - 40, C + 78, C + 105], fill=fg)
        d.polygon([(C - 40, C - 36), (C + 40, C - 36), (C + 26, C - 82), (C - 26, C - 82)], fill=fg)
        d.rectangle([C - 12, C - 6, C + 12, C + 80], fill=(30, 22, 18))
        d.rectangle([C - 46, C + 22, C + 46, C + 46], fill=(30, 22, 18))
    elif key == 'cheolong':                                # 리벳 둥근 판
        d.ellipse([C - 100, C - 100, C + 100, C + 100], fill=fg)
        d.ellipse([C - 62, C - 62, C + 62, C + 62], outline=(30, 22, 18), width=W)
        for a in (45, 135, 225, 315):
            x, y = C + 80 * math.cos(math.radians(a)), C + 80 * math.sin(math.radians(a))
            d.ellipse([x - 12, y - 12, x + 12, y + 12], fill=(30, 22, 18))
    elif key == 'eunha':                                   # 은하 소용돌이 + 별가루
        for off in (0, 180):
            pts = []
            for i in range(100):
                t = i / 99
                a = math.radians(off + t * 300)
                r = 10 + 98 * t
                pts.append((C + r * math.cos(a), C + r * math.sin(a)))
            d.line(pts, fill=fg, width=W + 8, joint='curve')
        for x, y, r in ((C - 80, C - 70, 9), (C + 84, C + 52, 8), (C + 20, C - 96, 7), (C - 30, C + 92, 7)):
            d.ellipse([x - r, y - r, x + r, y + r], fill=fg)
    elif key == 'maenghon':                                # 불꽃
        d.polygon([(C, C - 110), (C + 70, C - 10), (C + 56, C + 80), (C, C + 108), (C - 56, C + 80), (C - 74, C - 6), (C - 28, C - 36)], fill=fg)
        d.polygon([(C, C - 10), (C + 28, C + 40), (C, C + 82), (C - 28, C + 40)], fill=(30, 22, 18))
    elif key == 'biyeong':                                 # 휘어 올라가는 깃 셋(끝이 뾰족한 획)
        for i in range(3):
            base = C + 52 - i * 52
            pts = []
            for j in range(41):
                t = j / 40
                x = C - 104 + 208 * t
                y = base - 78 * math.sin(t * math.pi * 0.62) - 6 * i
                pts.append((x, y, 6 + 22 * math.sin(t * math.pi) ** 0.7 * (1 - 0.6 * t)))
            up = [(x, y - w / 2) for x, y, w in pts]
            dn = [(x, y + w / 2) for x, y, w in pts]
            d.polygon(up + dn[::-1], fill=fg)
    elif key == 'paewang':                                 # 왕관
        d.polygon([(C - 104, C + 60), (C - 104, C - 56), (C - 50, C + 4), (C, C - 84), (C + 50, C + 4), (C + 104, C - 56), (C + 104, C + 60)], fill=fg)
        d.rectangle([C - 104, C + 68, C + 104, C + 98], fill=fg)
        for x in (C - 104, C, C + 104):
            d.ellipse([x - 14, (C - 84 if x == C else C - 56) - 14, x + 14, (C - 84 if x == C else C - 56) + 14], fill=lighten(fg, 0.5))
    elif key == 'hyeonhak':                                # 학: 몸·긴 목·머리·부리·펼친 날개·다리
        d.ellipse([C - 78, C + 4, C + 52, C + 66], fill=fg)
        d.polygon([(C - 78, C + 30), (C - 118, C + 52), (C - 70, C + 56)], fill=fg)           # 꼬리
        neck = [(C + 34 + 38 * math.sin(t * 2.2), C + 20 - 108 * t) for t in [i / 20 for i in range(21)]]
        d.line(neck, fill=fg, width=22, joint='curve')
        hx, hy = neck[-1]
        d.ellipse([hx - 17, hy - 17, hx + 17, hy + 17], fill=fg)
        d.polygon([(hx + 12, hy - 4), (hx + 62, hy + 4), (hx + 12, hy + 10)], fill=fg)         # 부리
        d.polygon([(C - 70, C + 24), (C - 8, C - 76), (C + 34, C - 40), (C + 22, C + 18)], fill=lighten(fg, 0.0))
        d.polygon([(C - 40, C + 26), (C - 8, C - 52), (C + 14, C - 20), (C + 8, C + 22)], fill=(30, 22, 18))
        d.line([(C - 14, C + 64), (C - 26, C + 120)], fill=fg, width=12)
        d.line([(C + 18, C + 62), (C + 24, C + 120)], fill=fg, width=12)

def make(key):
    col = main_color(key)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 8, S - 8, S - 8], fill=darken(col, 0.78) + (255,))
    d.ellipse([8, 8, S - 8, S - 8], outline=lighten(col, 0.15) + (255,), width=18)
    d.ellipse([34, 34, S - 34, S - 34], outline=darken(col, 0.35) + (255,), width=5)
    em = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    emblem(ImageDraw.Draw(em), key, lighten(col, 0.55) + (255,), 18)
    im.alpha_composite(em)
    return im, col


def main(argv):
    out = os.path.join(ROOT, 'saga-assets', 'icons', 'setmark')
    if '--out' in argv:
        out = argv[argv.index('--out') + 1]
    os.makedirs(out, exist_ok=True)
    cells = []
    for k in SETS:
        im, col = make(k)
        im.resize((64, 64), Image.LANCZOS).save(os.path.join(out, k + '_64.png'))
        s32 = im.resize((32, 32), Image.LANCZOS)
        s32.save(os.path.join(out, k + '_32.png'))
        cells.append((k, im))
        lic = {'id': 'setmark_' + k, 'generator': 'tools/ai-art/setmark.py', 'model': '', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
               'derived': '도형 문양 + 세트 아이콘 대표색 %s — 384px 에서 32·64 로 줄임' % str(col), 'note': '2나락 세트 문양 %s(%s) — K-0196 ④' % (k, NAME[k]),
               'px': [32, 64], 'date': '2026-10-30', 'ticket': 'K-0196'}
        json.dump(lic, open(os.path.join(out, k + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('SETMARK', k, col)
    if '--sheet' in argv:
        sheet = Image.new('RGBA', (10 * 140, 200), (60, 56, 52, 255))
        for i, (k, im) in enumerate(cells):
            sheet.alpha_composite(im.resize((128, 128), Image.LANCZOS), (i * 140 + 6, 6))
            sheet.alpha_composite(im.resize((32, 32), Image.LANCZOS), (i * 140 + 14, 150))
            sheet.alpha_composite(im.resize((64, 64), Image.LANCZOS), (i * 140 + 60, 136))
        sheet.convert('RGB').save(argv[argv.index('--sheet') + 1])


if __name__ == '__main__':
    main(sys.argv[1:])
