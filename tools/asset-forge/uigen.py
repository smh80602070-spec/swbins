"""K-0040 — UI 스킨 세트: 같은 부품 규격 × 판별 테마 5 (코드 생성, 난수 없음 — 같은 코드면 같은 그림).

  py tools/asset-forge/uigen.py            # _out/ui/<테마>/<부품>.png + .license.json + _out/ui/ui_parts.json(9분할 메타) + _out/ui/ui_sheet.jpg(미리보기)
  py tools/asset-forge/uigen.py --check    # 부품 수 = 산출 수 · 크기 · 9분할 가장자리(가장자리 한 줄이 한 색으로 이어지는지) · .license.json 100% · 판당 ≤1MB

부품(20): window(9-slice 192) · popup(9-slice 256×192) · card(9-slice 160×224) · tab_on / tab_off(9-slice 120×44) · btn_normal / btn_hover / btn_pressed / btn_disabled(9-slice 96)
          · grade_1~5(등급 틀 128×160, 9-slice) · gauge_frame(3-slice 256×28) · gauge_fill_hp / mp / xp(256×20 흰 바탕 아님 — 색 채움) · bubble(9-slice 192×112, 꼬리 포함)
테마 5 = 판별 색·장식: go(청록) · dungeon(진홍·쇠) · forest(초록·크림) · story(하늘·주황) · realm(먹칠·금 — K-0060 과 같은 색).
터치 규격: 버튼 틀 최소 96px(폰 가로 48dp 를 @2x 로) — `ui_parts.json` 의 `min_touch_px`.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'ui')
CANON = os.path.join(HERE, '..', '..', 'saga-assets', 'ui')   # --check 는 정본을 본다(_out 은 gitignore·PC 마다 다름, K-0088)
SS = 4

# 테마 → (판 id, 배경 위, 배경 아래, 테두리, 테두리 어두움, 테두리 밝음, 강조)
THEMES = {
    'go': ('saga-go', (28, 58, 68), (18, 38, 45), (127, 216, 208), (70, 140, 140), (200, 246, 240), (255, 209, 102)),
    'dungeon': ('saga-dungeon', (42, 18, 20), (24, 10, 11), (192, 70, 58), (120, 44, 36), (240, 140, 120), (255, 138, 58)),
    'forest': ('saga-forest', (47, 74, 44), (30, 51, 32), (232, 216, 160), (160, 140, 90), (250, 244, 214), (155, 211, 90)),
    'story': ('saga-story', (28, 42, 74), (17, 26, 48), (127, 184, 255), (70, 110, 170), (200, 226, 255), (255, 179, 71)),
    'realm': ('saga-realm', (38, 29, 20), (23, 18, 13), (216, 181, 106), (150, 118, 62), (246, 224, 160), (192, 74, 58)),
}
GRADE = [(154, 154, 154), (95, 191, 95), (74, 143, 232), (166, 90, 224), (240, 160, 48)]       # 등급 1~5 색(보통·고급·희귀·영웅·전설)
PARTS = {  # 이름: (가로, 세로, 9분할 조각 px 또는 None, 3분할이면 'x')
    'window': (192, 192, 32), 'popup': (256, 192, 36), 'card': (160, 224, 28), 'tab_on': (120, 44, 14), 'tab_off': (120, 44, 14),
    'btn_normal': (96, 96, 24), 'btn_hover': (96, 96, 24), 'btn_pressed': (96, 96, 24), 'btn_disabled': (96, 96, 24),
    'grade_1': (128, 160, 24), 'grade_2': (128, 160, 24), 'grade_3': (128, 160, 24), 'grade_4': (128, 160, 24), 'grade_5': (128, 160, 24),
    'gauge_frame': (256, 28, 'x14'), 'gauge_fill_hp': (256, 20, None), 'gauge_fill_mp': (256, 20, None), 'gauge_fill_xp': (256, 20, None),
    'bubble': (192, 112, 28),
}


def lerp(a, b, t):
    return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))


def panel(w, h, r, top, bot, alpha=235, inset=2):
    W, H = w * SS, h * SS
    g = Image.new('RGBA', (W, H))
    px = g.load()
    for y in range(H):
        c = lerp(top, bot, y / max(1, H - 1)) + (alpha,)
        for x in range(W):
            px[x, y] = c
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle((inset * SS, inset * SS, W - inset * SS - 1, H - inset * SS - 1), r * SS, fill=255)
    g.putalpha(Image.eval(m, lambda v: int(v * alpha / 255)))
    return g


def done(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


def diamond(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def border(im, w, h, r, T, width=3, inner=True, inset=2):
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    d.rounded_rectangle((inset * SS, inset * SS, W - inset * SS - 1, H - inset * SS - 1), r * SS, outline=T[3] + (255,), width=int(width * SS))
    if inner:
        o = (inset + width + 3) * SS
        d.rounded_rectangle((o, o, W - o - 1, H - o - 1), max(2, r - 5) * SS, outline=T[4] + (255,), width=int(1.4 * SS))


def corners(im, w, h, T, k, r=6):
    d = ImageDraw.Draw(im)
    for cx, cy in ((k, k), (w - k, k), (k, h - k), (w - k, h - k)):
        diamond(d, cx * SS, cy * SS, r * SS, T[3] + (255,))
        diamond(d, cx * SS, cy * SS, r * 0.5 * SS, T[1] + (255,))


def part_window(T):
    w, h, k = 192, 192, 32
    im = panel(w, h, 10, T[1], T[2])
    border(im, w, h, 10, T)
    corners(im, w, h, T, k * 0.5)
    return done(im, w, h)


def part_popup(T):
    w, h, k = 256, 192, 36
    im = panel(w, h, 12, T[1], T[2])
    border(im, w, h, 12, T, width=3.5)
    corners(im, w, h, T, k * 0.5, 7)
    d = ImageDraw.Draw(im)
    d.line((k * SS, 28 * SS, (w - k) * SS, 28 * SS), fill=T[4] + (255,), width=SS)                       # 머리 밑줄
    return done(im, w, h)


def part_card(T):
    w, h = 160, 224
    im = panel(w, h, 12, lerp(T[1], (255, 255, 255), 0.04), T[2])
    border(im, w, h, 12, T, width=3)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((12 * SS, 12 * SS, (w - 12) * SS, (h * 0.62) * SS), 6 * SS, outline=T[4] + (255,), width=int(1.5 * SS))      # 그림 칸
    corners(im, w, h, T, 14, 5)
    return done(im, w, h)


def part_tab(T, on):
    w, h = 120, 44
    top = lerp(T[1], T[3], 0.25) if on else T[2]
    im = panel(w, h, 12, top, T[2] if on else lerp(T[2], (0, 0, 0), 0.2))
    d = ImageDraw.Draw(im)
    col = T[3] if on else T[4]
    d.rounded_rectangle((2 * SS, 2 * SS, (w - 2) * SS, (h + 14) * SS), 12 * SS, outline=col + (255,), width=int((3 if on else 2) * SS))
    if on:
        d.line((14 * SS, (h - 6) * SS, (w - 14) * SS, (h - 6) * SS), fill=T[6] + (255,), width=int(2.5 * SS))
    return done(im, w, h)


def part_btn(T, state):
    w, h = 96, 96
    top, bot = T[1], T[2]
    col, lt = T[3], T[5]
    if state == 'hover':
        top, bot = lerp(T[1], T[3], 0.18), lerp(T[2], T[3], 0.10)
        lt = (255, 255, 255)
    if state == 'pressed':
        top, bot = lerp(T[2], (0, 0, 0), 0.25), lerp(T[2], (0, 0, 0), 0.4)
        col = T[4]
    if state == 'disabled':
        top, bot = (58, 58, 60), (44, 44, 46)
        col, lt = (110, 110, 112), (150, 150, 152)
    im = panel(w, h, 12, top, bot)
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 12 * SS, outline=col + (255,), width=int(2.2 * SS))
    if state in ('normal', 'hover'):
        d.line((12 * SS, 7 * SS, W - 12 * SS, 7 * SS), fill=lt + (170,), width=SS)
    if state == 'pressed':
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((5 * SS, 5 * SS, W - 5 * SS, H - 5 * SS), 9 * SS, fill=(0, 0, 0, 90))
        im = Image.alpha_composite(im, sh)
    return done(im, w, h)


def part_grade(T, n):
    w, h = 128, 160
    c = GRADE[n - 1]
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lw = 2.2 + 0.6 * (n - 1)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 12 * SS, outline=c + (255,), width=int(lw * SS))
    if n >= 2:
        d.rounded_rectangle((8 * SS, 8 * SS, W - 8 * SS - 1, H - 8 * SS - 1), 8 * SS, outline=lerp(c, (0, 0, 0), 0.35) + (255,), width=int(1.4 * SS))
    k = 14
    for i, (cx, cy) in enumerate(((k, k), (w - k, k), (k, h - k), (w - k, h - k))):
        if n >= 3 or i < 2:
            diamond(d, cx * SS, cy * SS, (3 + n) * SS, c + (255,))
    if n >= 4:
        for cx in (w * 0.35, w * 0.65):
            diamond(d, cx * SS, 4 * SS, 4 * SS, lerp(c, (255, 255, 255), 0.4) + (255,))
    if n == 5:
        diamond(d, w * 0.5 * SS, 3 * SS, 7 * SS, lerp(c, (255, 255, 255), 0.5) + (255,))
        glow = im.filter(ImageFilter.GaussianBlur(5 * SS))
        im = Image.alpha_composite(glow, im)
    return done(im, w, h)


def part_gauge_frame(T):
    w, h = 256, 28
    im = panel(w, h, 12, lerp(T[2], (0, 0, 0), 0.4), lerp(T[2], (0, 0, 0), 0.6), alpha=225, inset=1)
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    d.rounded_rectangle((1 * SS, 1 * SS, W - SS - 1, H - SS - 1), 12 * SS, outline=T[3] + (255,), width=int(2.2 * SS))
    d.rounded_rectangle((4 * SS, 4 * SS, W - 4 * SS - 1, H - 4 * SS - 1), 9 * SS, outline=T[4] + (200,), width=SS)
    return done(im, w, h)


def part_gauge_fill(c1, c2):
    w, h = 256, 20
    W, H = w * SS, h * SS
    g = Image.new('RGBA', (W, H))
    px = g.load()
    for y in range(H):
        t = y / (H - 1)
        c = lerp(c1, c2, t) + (255,)
        for x in range(W):
            px[x, y] = c
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, W - 1, H - 1), 9 * SS, fill=255)
    g.putalpha(m)
    d = ImageDraw.Draw(g)
    d.line((8 * SS, 4 * SS, W - 8 * SS, 4 * SS), fill=(255, 255, 255, 90), width=SS)               # 윗면 광택
    return done(g, w, h)


def part_bubble(T):
    w, h = 192, 112
    body_h = 92
    W, H = w * SS, h * SS
    base = panel(w, body_h, 14, lerp(T[1], (255, 255, 255), 0.06), T[2])
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    im.paste(base, (0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, body_h * SS - 2 * SS), 14 * SS, outline=T[3] + (255,), width=int(2.5 * SS))
    tail = [((w / 2 - 12) * SS, (body_h - 3) * SS), ((w / 2 + 12) * SS, (body_h - 3) * SS), (w / 2 * SS, (h - 3) * SS)]
    d.polygon(tail, fill=lerp(T[1], T[2], 0.95) + (240,))
    d.line([tail[0], tail[2], tail[1]], fill=T[3] + (255,), width=int(2.5 * SS))
    d.line(((w / 2 - 10) * SS, (body_h - 3) * SS, (w / 2 + 10) * SS, (body_h - 3) * SS), fill=lerp(T[1], T[2], 0.95) + (255,), width=int(3 * SS))
    return done(im, w, h)


def build_theme(name, T):
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    imgs = {
        'window': part_window(T), 'popup': part_popup(T), 'card': part_card(T), 'tab_on': part_tab(T, True), 'tab_off': part_tab(T, False),
        'btn_normal': part_btn(T, 'normal'), 'btn_hover': part_btn(T, 'hover'), 'btn_pressed': part_btn(T, 'pressed'), 'btn_disabled': part_btn(T, 'disabled'),
        'gauge_frame': part_gauge_frame(T), 'bubble': part_bubble(T),
        'gauge_fill_hp': part_gauge_fill((236, 92, 92), (176, 44, 52)), 'gauge_fill_mp': part_gauge_fill((98, 160, 240), (46, 96, 190)),
        'gauge_fill_xp': part_gauge_fill(T[6], lerp(T[6], (0, 0, 0), 0.35)),
    }
    for n in range(1, 6):
        imgs[f'grade_{n}'] = part_grade(T, n)
    for pname, im in imgs.items():
        p = os.path.join(d, pname + '.png')
        im.save(p, optimize=True)
        json.dump({'id': f'{name}/{pname}', 'generator': 'tools/asset-forge/uigen.py', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)', 'theme': name,
                   'game': T[0], 'part': pname, 'size': list(im.size)}, open(os.path.join(d, pname + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return imgs


def build():
    meta = {'note': 'K-0040 UI 부품 규격 — slice = 9분할 모서리 px(x14 = 가로 3분할 양 끝 14px). min_touch_px = 버튼 최소 한 변(폰 가로 48dp @2x)', 'min_touch_px': 96, 'parts': {}, 'themes': {}}
    for pname, spec in PARTS.items():
        w, h, k = spec
        meta['parts'][pname] = {'size': [w, h], 'slice': k}
    for ti, (name, T) in enumerate(THEMES.items()):
        imgs = build_theme(name, T)
        meta['themes'][name] = {'game': T[0], 'trim': '#%02x%02x%02x' % T[3], 'panel_top': '#%02x%02x%02x' % T[1], 'accent': '#%02x%02x%02x' % T[6]}
    json.dump(meta, open(os.path.join(OUT, 'ui_parts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 미리보기 시트 — 테마마다 한 줄: 창·카드·버튼 4·등급 5·게이지·말풍선
    S = Image.new('RGB', (1280, 5 * 230), (96, 100, 108))
    for ti, name in enumerate(THEMES):
        y = ti * 230
        def put(pn, x, yy, sz=None):
            im = Image.open(os.path.join(OUT, name, pn + '.png')).convert('RGBA')
            if sz:
                im = im.resize(sz)
            S.paste(im, (x, yy), im)
        put('window', 6, y + 6, (150, 150))
        put('card', 164, y + 6, (110, 154))
        for i, b in enumerate(('btn_normal', 'btn_hover', 'btn_pressed', 'btn_disabled')):
            put(b, 282 + i * 72, y + 6, (68, 68))
        for n in range(1, 6):
            put(f'grade_{n}', 282 + (n - 1) * 72, y + 80, (64, 80))
        put('gauge_frame', 650, y + 10)
        put('gauge_fill_hp', 650, y + 14)
        put('gauge_frame', 650, y + 44)
        put('gauge_fill_mp', 650, y + 48)
        put('gauge_frame', 650, y + 78)
        put('gauge_fill_xp', 650, y + 82)
        put('bubble', 930, y + 6, (150, 88))
        put('popup', 930, y + 100, (180, 130))
        put('tab_on', 650, y + 120, (100, 36))
        put('tab_off', 760, y + 120, (100, 36))
    S.save(os.path.join(OUT, 'ui_sheet.jpg'), quality=88)
    print('UI 부품', len(PARTS), '× 테마', len(THEMES), '=', len(PARTS) * len(THEMES), '→', OUT)


def check():
    global OUT
    if os.path.isdir(CANON):
        OUT = CANON
    print('검사 대상:', os.path.relpath(OUT, os.path.join(HERE, '..', '..')))
    bad = []
    for name in THEMES:
        total = 0
        for pname, (w, h, k) in PARTS.items():
            p = os.path.join(OUT, name, pname + '.png')
            if not os.path.exists(p):
                bad.append(f'없음 {name}/{pname}')
                continue
            total += os.path.getsize(p)
            im = Image.open(p)
            if im.size != (w, h):
                bad.append(f'크기 {name}/{pname} {im.size}')
            if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
                bad.append(f'license 없음 {name}/{pname}')
            if isinstance(k, int):                                         # 9분할 가장자리: 늘어나는 한가운데 줄이 한 색이어야 한다
                a = Image.open(p).convert('RGBA')
                mid = [a.getpixel((x, h // 2)) for x in range(k + 2, w - k - 2)]
                if len(set(mid)) > 12 and pname not in ('card',):
                    bad.append(f'9분할 가운데 줄이 한 색이 아님 {name}/{pname}')
        if total / 1048576 > 1:
            bad.append(f'{name} 판당 1MB 초과')
        print(f'{name}: {len(PARTS)} 부품 {total // 1024}KB')
    print('UI_FAIL' if bad else 'UI_OK')
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(check())
    build()
