"""K-0202 ② — 사가나락 UI 「乙 새긴 돌판」(사용자 10-26 고름): uigen.py 와 같은 부품 20·같은 크기·같은 9분할, 2나락 테마만 다른 모양 언어로.
모양 = 모서리 깎은(팔각) 돌판 · 위 밝은 날·아래 그늘 날 · 테두리 띠에만 돌 결(얼룩·균열, 난수 씨앗 고정) · 안쪽 새김 줄 · 버튼은 팔각 + 붉은 상감 · 아이콘 없음(글은 판 글꼴).
9분할: 늘어나는 한가운데는 가로 한 줄이 한 색(세로 그러데이션만) — uigen.py --check 그대로 통과.

  py tools/asset-forge/uigen_stone.py            # _out/ui/dungeon_stone/<부품>.png + license + 시트 _out/ui/dungeon_stone_sheet.jpg
  py tools/asset-forge/uigen_stone.py --publish  # 정본 saga-assets/ui/dungeon + 웹 공용 saga-web/shared/assets/ui/dungeon + 판 saga-web/saga-dungeon/assets/ui 에 덮기(같은 이름)
"""
import json
import os
import random
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'ui', 'dungeon_stone')
SS = 4
STONE_T, STONE_B = (87, 80, 73), (43, 39, 35)          # 돌 위·아래
FACE_T, FACE_B = (52, 47, 43), (30, 27, 24)            # 안쪽 면(어두운 돌)
LIT, SHADE, CUT = (125, 116, 106), (25, 22, 20), (18, 16, 14)
RED, RED_D = (140, 42, 28), (86, 18, 8)
GRADE = [(150, 146, 138), (96, 160, 92), (80, 128, 200), (150, 92, 200), (216, 150, 52)]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def octo(w, h, c):
    """모서리 c 를 깎은 팔각 다각형(SS 배율)."""
    W, H, C = w * SS, h * SS, c * SS
    return [(C, 0), (W - C, 0), (W, C), (W, H - C), (W - C, H), (C, H), (0, H - C), (0, C)]


def vgrad(W, H, top, bot):
    g = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(g)
    for y in range(H):
        d.line((0, y, W, y), fill=lerp(top, bot, y / max(1, H - 1)))
    return g


def stone_band(W, H, band, seed):
    """테두리 띠(가장자리 band px)에만 돌 얼룩·점·균열 — 가운데는 건드리지 않는다(9분할 늘림)."""
    rnd = random.Random(seed)
    tex = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(tex)
    B = band * SS
    def inband(x, y):
        return x < B or x > W - B or y < B or y > H - B
    for _ in range(int(W * H / (SS * SS * 9))):
        x, y = rnd.randrange(W), rnd.randrange(H)
        if not inband(x, y):
            continue
        r = rnd.choice((1, 1, 2, 3)) * SS // 2
        v = rnd.choice((255, 0))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(v, v, v, rnd.randrange(10, 34)))
    for _ in range(max(2, (W + H) // (SS * 70))):               # 균열 몇 줄
        x, y = rnd.randrange(W), rnd.choice((rnd.randrange(B), H - rnd.randrange(B)))
        pts = [(x, y)]
        for _ in range(rnd.randrange(3, 6)):
            x += rnd.randrange(-6, 7) * SS; y += rnd.randrange(-3, 4) * SS
            pts.append((x, y))
        if all(inband(px_, py_) for px_, py_ in pts):
            d.line(pts, fill=(12, 10, 9, 150), width=SS)
            d.line([(px_ + SS, py_ + SS) for px_, py_ in pts], fill=(150, 140, 128, 50), width=SS)
    return tex.filter(ImageFilter.GaussianBlur(SS * 0.4))


def slab(w, h, c, band, seed, face=True, edge=RED_D, edge_w=0):
    """깎은 돌판 하나: 돌 결 테두리 + 위 밝은 날·아래 그늘 날 + 안쪽 새김 줄 + (선택) 상감 테두리."""
    W, H = w * SS, h * SS
    base = vgrad(W, H, STONE_T, STONE_B).convert('RGBA')
    if face:
        f = vgrad(W, H, FACE_T, FACE_B).convert('RGBA')
        m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).polygon([(x + (band * 0.55 * SS if x < W / 2 else -band * 0.55 * SS), y + (band * 0.55 * SS if y < H / 2 else -band * 0.55 * SS)) for x, y in octo(w, h, c)], fill=255)
        base.paste(f, (0, 0), m)
    base = Image.alpha_composite(base, stone_band(W, H, band, seed))
    d = ImageDraw.Draw(base)
    P = octo(w, h, c)
    d.line([P[7], P[0], P[1], P[2]], fill=LIT + (255,), width=int(2 * SS))          # 위·왼 밝은 날
    d.line([P[3], P[4], P[5], P[6]], fill=SHADE + (255,), width=int(3 * SS))        # 아래 그늘 날
    if face:
        ins = band * 0.55 * SS
        Q = [(x + (ins if x < W / 2 else -ins), y + (ins if y < H / 2 else -ins)) for x, y in P]
        d.line(Q + [Q[0]], fill=CUT + (255,), width=int(1.6 * SS))                  # 새김 줄(그늘)
        d.line([(x + SS, y + SS) for x, y in Q] + [(Q[0][0] + SS, Q[0][1] + SS)], fill=LIT + (90,), width=SS)
    if edge_w:
        d.line(P + [P[0]], fill=edge + (255,), width=int(edge_w * SS))
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(P, fill=255)
    base.putalpha(m)
    return base


def done(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


def part_btn(state):
    w, h, c = 96, 96, 20
    W, H = w * SS, h * SS
    top, bot = (54, 47, 43), (30, 26, 23)
    rim = RED
    if state == 'hover':
        top, bot, rim = (70, 61, 55), (40, 34, 30), (176, 60, 40)
    if state == 'pressed':
        top, bot, rim = (26, 23, 21), (20, 18, 16), RED_D
    if state == 'disabled':
        top, bot, rim = (58, 58, 58), (44, 44, 44), (96, 92, 88)
    im = vgrad(W, H, top, bot).convert('RGBA')
    im = Image.alpha_composite(im, stone_band(W, H, 22, 11))
    d = ImageDraw.Draw(im)
    P = octo(w, h, c)
    d.line(P + [P[0]], fill=rim + (255,), width=int(3.5 * SS))                       # 붉은 상감
    if state == 'pressed':
        d.line([P[7], P[0], P[1], P[2]], fill=(10, 9, 8, 255), width=int(3 * SS))    # 눌림 = 위 그늘
    elif state != 'disabled':
        Q = [(x + (5 * SS if x < W / 2 else -5 * SS), y + (5 * SS if y < H / 2 else -5 * SS)) for x, y in P]
        d.line([Q[7], Q[0], Q[1], Q[2]], fill=LIT + (150,), width=SS)
        d.line([Q[3], Q[4], Q[5], Q[6]], fill=SHADE + (220,), width=int(1.5 * SS))
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(P, fill=255)
    im.putalpha(m)
    return done(im, w, h)


def part_tab(on):
    w, h = 120, 44
    W, H = w * SS, h * SS
    top, bot = ((78, 70, 63), (52, 46, 41)) if on else ((40, 36, 33), (28, 25, 22))
    im = vgrad(W, H, top, bot).convert('RGBA')
    im = Image.alpha_composite(im, stone_band(W, H, 12, 21 if on else 22))
    d = ImageDraw.Draw(im)
    c = 12 * SS
    P = [(c, 0), (W - c, 0), (W, c), (W, H), (0, H), (0, c)]
    d.line([P[5], P[0], P[1], P[2]], fill=(LIT if on else (70, 64, 58)) + (255,), width=int(2 * SS))
    if on:
        d.line((14 * SS, H - 5 * SS, W - 14 * SS, H - 5 * SS), fill=RED + (255,), width=int(3 * SS))
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(P, fill=255)
    im.putalpha(m)
    return done(im, w, h)


def part_grade(n):
    w, h = 128, 160
    col = GRADE[n - 1]
    im = slab(w, h, 16, 22, 30 + n, face=False)
    W, H = w * SS, h * SS
    d = ImageDraw.Draw(im)
    P = octo(w, h, 16)
    d.line(P + [P[0]], fill=col + (255,), width=int((2.0 + 0.6 * n) * SS))          # 등급 색 상감
    # 가운데는 비운다(그림이 들어갈 칸) — 안쪽을 투명하게 파내고 새김 줄
    hole = Image.new('L', (W, H), 0)
    ins = 14 * SS
    Q = [(x + (ins if x < W / 2 else -ins), y + (ins if y < H / 2 else -ins)) for x, y in P]
    ImageDraw.Draw(hole).polygon(Q, fill=255)
    a = im.split()[3]
    im.putalpha(Image.composite(Image.new('L', (W, H), 0), a, hole))
    d = ImageDraw.Draw(im)
    d.line(Q + [Q[0]], fill=CUT + (255,), width=int(1.6 * SS))
    gx, gy, r = W // 2, 7 * SS, (3 + n) * SS                                         # 위 가운데 보석(등급 높을수록 큼)
    if n >= 2:
        d.polygon([(gx, gy - r), (gx + r, gy), (gx, gy + r), (gx - r, gy)], fill=lerp(col, (255, 255, 255), 0.25) + (255,), outline=(12, 10, 9, 255))
    if n == 5:
        glow = im.filter(ImageFilter.GaussianBlur(4 * SS))
        im = Image.alpha_composite(glow, im)
    return done(im, w, h)


def part_gauge_frame():
    w, h = 256, 28
    W, H = w * SS, h * SS
    im = vgrad(W, H, (36, 32, 29), (22, 20, 18)).convert('RGBA')
    im = Image.alpha_composite(im, stone_band(W, H, 14, 41))
    d = ImageDraw.Draw(im)
    c = 8 * SS
    P = [(c, 0), (W - c, 0), (W, c), (W, H - c), (W - c, H), (c, H), (0, H - c), (0, c)]
    d.line([P[7], P[0], P[1], P[2]], fill=SHADE + (255,), width=int(2.5 * SS))     # 홈이라 위가 그늘
    d.line([P[3], P[4], P[5], P[6]], fill=LIT + (200,), width=int(1.5 * SS))
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(P, fill=255)
    im.putalpha(m)
    return done(im, w, h)


def part_gauge_fill(c1, c2, seed):
    w, h = 256, 20
    W, H = w * SS, h * SS
    g = vgrad(W, H, c1, c2).convert('RGBA')
    d = ImageDraw.Draw(g)
    d.line((0, 3 * SS, W, 3 * SS), fill=lerp(c1, (255, 255, 255), 0.35) + (160,), width=SS)
    c = 6 * SS
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(c, 0), (W - c, 0), (W, c), (W, H - c), (W - c, H), (c, H), (0, H - c), (0, c)], fill=255)
    g.putalpha(m)
    return done(g, w, h)


def part_bubble():
    w, h, body = 192, 112, 92
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    s = slab(w, body, 14, 22, 51)
    im.paste(s, (0, 0), s)
    d = ImageDraw.Draw(im)
    tail = [((w / 2 - 12) * SS, (body - 4) * SS), ((w / 2 + 12) * SS, (body - 4) * SS), (w / 2 * SS, (h - 3) * SS)]
    d.polygon(tail, fill=STONE_B + (255,))
    d.line([tail[1], tail[2]], fill=SHADE + (255,), width=int(3 * SS))
    d.line([tail[0], tail[2]], fill=LIT + (200,), width=int(1.5 * SS))
    return done(im, w, h)


def build():
    os.makedirs(OUT, exist_ok=True)
    imgs = {
        'window': done(slab(192, 192, 26, 32, 1), 192, 192),
        'popup': done(slab(256, 192, 30, 36, 2), 256, 192),
        'card': done(slab(160, 224, 22, 28, 3), 160, 224),
        'tab_on': part_tab(True), 'tab_off': part_tab(False),
        'btn_normal': part_btn('normal'), 'btn_hover': part_btn('hover'), 'btn_pressed': part_btn('pressed'), 'btn_disabled': part_btn('disabled'),
        'gauge_frame': part_gauge_frame(), 'bubble': part_bubble(),
        'gauge_fill_hp': part_gauge_fill((168, 40, 30), (92, 14, 10), 61), 'gauge_fill_mp': part_gauge_fill((62, 92, 150), (26, 40, 82), 62),
        'gauge_fill_xp': part_gauge_fill((200, 150, 62), (120, 80, 24), 63),
    }
    for n in range(1, 6):
        imgs[f'grade_{n}'] = part_grade(n)
    for pn, im in imgs.items():
        im.save(os.path.join(OUT, pn + '.png'), optimize=True)
        json.dump({'id': f'dungeon/{pn}', 'generator': 'tools/asset-forge/uigen_stone.py (K-0202 乙 새긴 돌판)', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
                   'theme': 'dungeon', 'game': 'saga-dungeon', 'part': pn, 'size': list(im.size)},
                  open(os.path.join(OUT, pn + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    S = Image.new('RGB', (1100, 420), (14, 12, 11))
    def put(pn, x, y, sz=None):
        im = imgs[pn]
        if sz:
            im = im.resize(sz)
        S.paste(im, (x, y), im)
    put('window', 10, 10); put('popup', 212, 10); put('card', 478, 10)
    for i, b in enumerate(('btn_normal', 'btn_hover', 'btn_pressed', 'btn_disabled')):
        put(b, 650 + i * 104, 10)
    for n in range(1, 6):
        put(f'grade_{n}', 10 + (n - 1) * 136, 240)
    for i, g in enumerate(('hp', 'mp', 'xp')):
        put('gauge_frame', 700, 130 + i * 40); put('gauge_fill_' + g, 700, 134 + i * 40)
    put('tab_on', 700, 260); put('tab_off', 830, 260); put('bubble', 700, 312)
    S.save(os.path.join(OUT, '..', 'dungeon_stone_sheet.jpg'), quality=90)
    print('K202_STONE', len(imgs), '부품 →', OUT)


def publish():
    for dst in ('saga-assets/ui/dungeon', 'saga-web/shared/assets/ui/dungeon', 'saga-web/saga-dungeon/assets/ui'):
        d = os.path.join(ROOT, dst)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(OUT):
            if f.endswith('.png') or (f.endswith('.license.json') and not dst.endswith('assets/ui')):
                shutil.copy(os.path.join(OUT, f), os.path.join(d, f))
            elif f.endswith('.license.json') and os.path.exists(os.path.join(d, f)):
                shutil.copy(os.path.join(OUT, f), os.path.join(d, f))
    print('K202_PUBLISH dungeon → 정본·웹 공용·판')


if __name__ == '__main__':
    build()
    if '--publish' in sys.argv:
        publish()
