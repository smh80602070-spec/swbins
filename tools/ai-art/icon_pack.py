"""아이템 아이콘 포장(K-0035 단계 2~3) — AI 가 흰 배경에 그린 알맹이를 투명하게 따고, 등급 틀(코드)과 합쳐 아이콘 세트를 만든다.

    py tools/ai-art/icon_pack.py <원본폴더> <출력폴더> [--spec tools/ai-art/data/icon_trial30.json]
      원본폴더: gen.py 결과(<id>.png + <id>.license.json)   출력: content/<id>.png(알맹이 128px 투명) · frames/<등급>.png(틀 128px)
      icon/<id>_g<등급>.png(합성 128px) · icon64/<id>_g<등급>.png · sheet.jpg(확인용 한 장) · report.json(검사 결과)

규격(정본 = ICON_SPEC):
  - 마스터 128px, 64px 는 줄여서. 알맹이는 투명 PNG(128px, 가장자리 번짐 1px), 틀은 따로(게임은 틀 위에 알맹이를 얹는다 — 등급이 바뀌어도 알맹이는 한 장).
  - 알맹이는 상자의 84% 안에 들어가게(위쪽 여백 4%), 바닥에 부드러운 그림자(코드).
  - 등급 5: 0 보통(회색) · 1 마법(파랑) · 2 희귀(노랑) · 3 세트(초록) · 4 유니크(주황). 3 등급만 쓰는 판은 0·2·4 를 쓴다.
  - 틀: 둥근 사각형 바탕 그라데이션 + 안쪽 선 + 바깥 테두리, 3 이상은 모서리 장식, 4 는 바깥 빛.
검사: 알맹이가 차지하는 비율 8~85% · 가장자리에 흰 테 없음 · 투명 비율 ≥ 15%. 실패한 것은 report.json 에 이유와 함께 남는다.
의존: Pillow·numpy(시스템 파이썬).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

S = 128
GRADES = {
    0: {'name': '보통', 'edge': (150, 156, 164), 'glow': None, 'bg': ((44, 46, 52), (26, 28, 33))},
    1: {'name': '마법', 'edge': (84, 140, 235), 'glow': None, 'bg': ((38, 54, 92), (20, 28, 54))},
    2: {'name': '희귀', 'edge': (232, 190, 70), 'glow': None, 'bg': ((84, 68, 30), (44, 34, 14))},
    3: {'name': '세트', 'edge': (90, 200, 120), 'glow': (90, 200, 120), 'bg': ((30, 78, 48), (14, 40, 24))},
    4: {'name': '유니크', 'edge': (238, 128, 48), 'glow': (255, 150, 60), 'bg': ((96, 52, 22), (50, 24, 10))},
}


def matte(im, tol=26):
    """흰 배경 제거 — 가장자리에서 시작해 배경색과 비슷한 이어진 영역을 지운다(안쪽 흰 부분은 남김). 가장자리는 1px 부드럽게."""
    im = im.convert('RGB')
    a = np.asarray(im).astype(np.int16)
    h, w = a.shape[:2]
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]), axis=0)
    dist = np.abs(a - bg).max(axis=2)
    cand = dist <= tol
    seen = np.zeros((h, w), bool)
    stack = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)] + [(0, x) for x in range(0, w, 8)] + [(h - 1, x) for x in range(0, w, 8)] \
        + [(y, 0) for y in range(0, h, 8)] + [(y, w - 1) for y in range(0, h, 8)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not cand[y, x]:
            continue
        seen[y, x] = True
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # 작은 구멍 메우기 + 가장자리 번짐
    al = Image.fromarray(alpha).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    out = im.convert('RGBA')
    out.putalpha(al)
    return out


def fit_content(rgba, box=0.84):
    bb = rgba.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not bb:
        return None
    c = rgba.crop(bb)
    s = box * S / max(c.size)
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    x = (S - c.width) // 2
    y = max(round(S * 0.04), (S - c.height) // 2 - 2)
    canvas.alpha_composite(c, (x, y))
    return canvas


def frame(grade):
    g = GRADES[grade]
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if g['glow']:
        glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(glow).rounded_rectangle((3, 3, S - 4, S - 4), 16, outline=g['glow'] + (200,), width=4)
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4)))
    top, bot = g['bg']
    grad = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=tuple(round(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((5, 5, S - 6, S - 6), 14, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((5, 5, S - 6, S - 6), 14, outline=g['edge'] + (255,), width=3)
    d.rounded_rectangle((9, 9, S - 10, S - 10), 10, outline=tuple(min(255, c + 40) for c in g['edge']) + (90,), width=1)
    if grade >= 3:      # 모서리 장식
        for cx, cy in ((12, 12), (S - 13, 12), (12, S - 13), (S - 13, S - 13)):
            d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=g['edge'] + (255,), outline=(255, 255, 255, 160))
    if grade >= 4:
        d.rounded_rectangle((2, 2, S - 3, S - 3), 17, outline=g['glow'] + (140,), width=1)
    return img


def shadow(content):
    a = content.getchannel('A')
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    black = Image.new('RGBA', (S, S), (0, 0, 0, 120))
    sh.paste(black, (0, 4), a)
    return sh.filter(ImageFilter.GaussianBlur(3))


def glyph_content(ch, grade):
    """룬 — 한자 한 글자를 새긴 돌 조각(코드). 등급 색은 틀이 맡고, 글자·돌은 한 장."""
    fnt = ImageFont.truetype('C:/Windows/Fonts/batang.ttc', 70)
    stone = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(stone)
    d.rounded_rectangle((22, 14, S - 23, S - 15), 16, fill=(108, 112, 120, 255), outline=(60, 62, 70, 255), width=3)
    d.rounded_rectangle((28, 20, S - 29, S - 21), 12, outline=(160, 164, 172, 160), width=1)
    tint = GRADES[grade]['edge']
    txt = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    td.text((S // 2, S // 2 - 2), ch, font=fnt, anchor='mm', fill=tint + (255,), stroke_width=2, stroke_fill=(30, 30, 36, 255))
    glow = txt.filter(ImageFilter.GaussianBlur(5))
    stone.alpha_composite(glow)
    stone.alpha_composite(txt)
    return stone


def dye_content(hexcolor):
    """염색 — 접은 천 견본(코드)."""
    col = tuple(int(hexcolor[i:i + 2], 16) for i in (1, 3, 5))
    dark = tuple(int(c * 0.72) for c in col)
    light = tuple(min(255, int(c * 1.18) + 12) for c in col)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 24, S - 21, S - 22), 9, fill=dark + (255,), outline=(20, 20, 24, 255), width=2)
    d.rounded_rectangle((20, 24, S - 21, 64), 9, fill=col + (255,))
    d.rectangle((20, 40, S - 21, 64), fill=col + (255,))
    d.polygon([(20, 62), (S - 21, 50), (S - 21, 66), (20, 78)], fill=light + (255,))
    d.rounded_rectangle((20, 24, S - 21, S - 22), 9, outline=(20, 20, 24, 255), width=2)
    for x in range(30, S - 24, 12):     # 올 무늬
        d.line([(x, 28), (x, S - 26)], fill=(255, 255, 255, 26), width=1)
    return im


def check(content):
    a = np.asarray(content.getchannel('A')).astype(float) / 255
    cover = float((a > 0.1).mean())
    transparent = float((a < 0.05).mean())
    ring = np.concatenate([a[:3].ravel(), a[-3:].ravel(), a[:, :3].ravel(), a[:, -3:].ravel()])
    rgb = np.asarray(content.convert('RGB')).astype(float)
    solid = a > 0.9
    white_edge = 0.0
    if solid.any():
        ed = solid & ~np.asarray(content.getchannel('A').point(lambda v: 255 if v > 250 else 0).filter(ImageFilter.MinFilter(5))) .astype(bool)
        if ed.any():
            white_edge = float((rgb[ed].min(axis=1) > 235).mean())
    why = []
    if cover < 0.08:
        why.append('알맹이 너무 작음(%.0f%%)' % (cover * 100))
    if cover > 0.85:
        why.append('알맹이 너무 큼(%.0f%%)' % (cover * 100))
    if transparent < 0.15:
        why.append('투명 비율 낮음(%.0f%%)' % (transparent * 100))
    if white_edge > 0.35:
        why.append('가장자리 흰 테 의심(%.0f%%)' % (white_edge * 100))
    return {'cover': round(cover, 3), 'transparent': round(transparent, 3), 'white_edge': round(white_edge, 3), 'ok': not why, 'why': why}


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(a) < 2:
        print(__doc__)
        return 2
    src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
    spec_path = sys.argv[sys.argv.index('--spec') + 1] if '--spec' in sys.argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'icon_trial30.json')
    spec = {i['id']: i for i in json.load(open(spec_path, encoding='utf-8'))['items']}
    for d in ('content', 'frames', 'icon', 'icon64'):
        os.makedirs(os.path.join(out, d), exist_ok=True)
    fr = {g: frame(g) for g in GRADES}
    for g, im in fr.items():
        im.save(os.path.join(out, 'frames', 'grade%d.png' % g))
    report = {}
    cells = []
    for iid, it in spec.items():
        p = os.path.join(src, iid + '.png')
        if not os.path.exists(p):
            report[iid] = {'ok': False, 'why': ['원본 없음']}
            continue
        c = fit_content(matte(Image.open(p)))
        if c is None:
            report[iid] = {'ok': False, 'why': ['알맹이를 못 땄다']}
            continue
        c.save(os.path.join(out, 'content', iid + '.png'))
        rep = check(c)
        report[iid] = rep
        g = it.get('grade', 0)
        comp = fr[g].copy()
        comp.alpha_composite(shadow(c))
        comp.alpha_composite(c)
        comp.save(os.path.join(out, 'icon', '%s_g%d.png' % (iid, g)))
        comp.resize((64, 64), Image.LANCZOS).save(os.path.join(out, 'icon64', '%s_g%d.png' % (iid, g)))
        cells.append((iid, comp, rep['ok']))
    # 코드로 만드는 것(룬 글리프·염색 견본) — 계획표 entries 의 mode 가 glyph·color 인 것
    for e in json.load(open(spec_path, encoding='utf-8')).get('entries', []):
        if e.get('mode') not in ('glyph', 'color'):
            continue
        iid, g = e['key'], e.get('grade', 0)
        c = glyph_content(e['glyph'], g) if e['mode'] == 'glyph' else dye_content(e['color'])
        c.save(os.path.join(out, 'content', iid + '.png'))
        rep = check(c)
        report[iid] = rep
        comp = fr[g].copy()
        comp.alpha_composite(shadow(c))
        comp.alpha_composite(c)
        comp.save(os.path.join(out, 'icon', '%s_g%d.png' % (iid, g)))
        comp.resize((64, 64), Image.LANCZOS).save(os.path.join(out, 'icon64', '%s_g%d.png' % (iid, g)))
        cells.append((iid, comp, rep['ok']))
    # 확인용 한 장: 6열, 아이콘 128px + 이름
    cols = 6
    rows = (len(cells) + cols - 1) // cols
    cw, ch = 150, 160
    sheet = Image.new('RGB', (cols * cw, rows * ch), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, (iid, comp, ok) in enumerate(cells):
        x, y = (i % cols) * cw + 11, (i // cols) * ch + 6
        sheet.paste(comp, (x, y), comp)
        d.text((x, y + 132), iid + ('' if ok else ' !'), fill=(235, 235, 235) if ok else (255, 120, 120))
    sheet.save(os.path.join(out, 'sheet.jpg'), quality=90)
    # 등급 틀 한 줄(틀 확인)
    strip = Image.new('RGB', (S * 5 + 24, S + 8), (24, 24, 28))
    for g in range(5):
        strip.paste(fr[g], (4 + g * (S + 4), 4), fr[g])
    strip.save(os.path.join(out, 'frames_strip.jpg'), quality=90)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = [k for k, v in report.items() if not v['ok']]
    print('아이콘 %d개 포장 · 검사 실패 %d %s' % (len(cells), len(bad), bad))
    return 0


if __name__ == '__main__':
    sys.exit(main())
