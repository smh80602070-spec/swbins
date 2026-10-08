"""K-0060 — 사가천하 전략 화면 에셋: UI 틀 9-slice·배너·버튼·구분선(코드 그림) · 깃발(코드) · 지방 이름 붓글씨 28장(OFL 글꼴 굽기) · 서체 서브셋 woff2 · 성 아이콘 3등급(AI).

  py tools/ai-art/make_realm_ui.py fonts            글꼴 받기(OFL: Nanum Brush Script·Noto Serif KR) → _out/fonts/
  py tools/ai-art/make_realm_ui.py ui               UI 틀·깃발·지방 글씨 → _out/realm_ui/
  py tools/ai-art/make_realm_ui.py woff2            서체 부분 서브셋 → _out/realm_ui/strategy-serif.woff2
  py tools/ai-art/make_realm_ui.py castle-init      성 밑그림 콜라주(정본 지물 스프라이트) → _out/realm_castle_init/
  py tools/ai-art/make_realm_ui.py castle-batch     성 아이콘 AI 배치 → batches/realm_castle.json (gen.py 로 생성)
  py tools/ai-art/make_realm_ui.py castle-pack      생성 그림을 128px 알파로 → _out/realm_ui/castle_{s,m,l}.webp
  py tools/ai-art/make_realm_ui.py check            규격·용량(≤3MB)·.license.json 100% 점검

색: 먹 #17120d~#261d14 · 금 #d8b56a (웹 CSS `--sg-lacquer`·`--sg-trim`). 지방 28개 이름은 data-city.js PROVINCES 에서 뽑는다.
한글을 AI 가 틀리게 그리므로 글씨는 전부 글꼴로 굽는다. 붓글씨 = Nanum Brush Script(OFL), 한자(양주 涼·揚)와 서브셋 서체 = Noto Serif KR(OFL).
"""
import hashlib
import json
import os
import re
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'realm_ui')
FONTS = os.path.join(HERE, '_out', 'fonts')
REALM_JS = os.path.join(ROOT, 'saga-web', 'saga-realm', 'js')
LAC_TOP, LAC_BOT = (38, 29, 20), (23, 18, 13)
GOLD, GOLD_DK, GOLD_LT = (216, 181, 106), (150, 118, 62), (246, 224, 160)
INK = (30, 22, 14)
SS = 4                                                                           # 그릴 때 배율(깎아 내려 가장자리를 부드럽게)

FONT_URLS = {
    'NanumBrushScript-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf',
    'NotoSerifKR.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf',
    'OFL-NanumBrush.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/OFL.txt',
    'OFL-NotoSerif.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/OFL.txt',
}
LIC_MADE = {'generator': 'tools/ai-art/make_realm_ui.py', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
            'note': '코드(PIL)로 그린 UI 그림. 색은 먹·금 팔레트.'}


def provinces():
    s = open(os.path.join(REALM_JS, 'data-city.js'), encoding='utf-8').read()
    i = s.index('var PROVINCES = {')
    j = s.index('};', i)
    return re.findall(r"(\w+):\s*'([^']+)'", s[i:j])


def save(im, name, fmt='PNG', lic=None):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    if fmt == 'WEBP':
        im.save(p, 'WEBP', quality=90, method=6)
    else:
        im.save(p, 'PNG', optimize=True)
    d = dict(LIC_MADE)
    d.update(lic or {})
    if d.get('model_license'):          # AI 그림은 코드 CC0 가 아니라 모델 라이선스(K-0088)
        d['license'] = d['model_license']
    d['id'] = os.path.splitext(name)[0]
    json.dump(d, open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return p


def grad(w, h):
    g = Image.new('RGBA', (w, h))
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(LAC_TOP[k] + (LAC_BOT[k] - LAC_TOP[k]) * t) for k in range(3))
        for x in range(w):
            px[x, y] = c + (235,)
    return g


def lacquer(w, h, r, inset):
    """먹칠 옻칠 판(둥근 모서리, 안쪽 반투명 ~0.92)."""
    W, H = w * SS, h * SS
    base = grad(W, H)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((inset * SS, inset * SS, W - inset * SS - 1, H - inset * SS - 1), r * SS, fill=255)
    base.putalpha(Image.eval(mask, lambda v: int(v * 235 / 255)))
    return base


def finish(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


def diamond(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def panel(w=192, h=192, corner=32):
    im = lacquer(w, h, 10, 2)
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 10 * SS, outline=GOLD + (255,), width=3 * SS)       # 바깥 금테 3px
    d.rounded_rectangle((8 * SS, 8 * SS, W - 8 * SS - 1, H - 8 * SS - 1), 6 * SS, outline=GOLD_DK + (255,), width=int(1.5 * SS))   # 안쪽 가는 금테
    for cx, cy in ((corner * 0.5, corner * 0.5), (w - corner * 0.5, corner * 0.5), (corner * 0.5, h - corner * 0.5), (w - corner * 0.5, h - corner * 0.5)):
        diamond(d, cx * SS, cy * SS, 7 * SS, GOLD + (255,))                                                                    # 모서리 장식
        diamond(d, cx * SS, cy * SS, 3.5 * SS, LAC_BOT + (255,))
    return finish(im, w, h)


def banner(w=384, h=72, end=72):
    im = lacquer(w, h, 14, 3)
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    d.rounded_rectangle((3 * SS, 3 * SS, W - 3 * SS - 1, H - 3 * SS - 1), 14 * SS, outline=GOLD + (255,), width=3 * SS)
    d.line((end * SS, 9 * SS, W - end * SS, 9 * SS), fill=GOLD_DK + (255,), width=SS)                                         # 가운데 늘어나는 구간의 가는 줄
    d.line((end * SS, H - 9 * SS, W - end * SS, H - 9 * SS), fill=GOLD_DK + (255,), width=SS)
    for cx in (end * 0.5, w - end * 0.5):                                                                                  # 양 끝 장식(고리 + 마름모)
        cy = h / 2
        d.ellipse(((cx - 17) * SS, (cy - 17) * SS, (cx + 17) * SS, (cy + 17) * SS), outline=GOLD + (255,), width=2 * SS)
        diamond(d, cx * SS, cy * SS, 9 * SS, GOLD + (255,))
        diamond(d, cx * SS, cy * SS, 4 * SS, LAC_BOT + (255,))
    return finish(im, w, h)


def button(pressed, w=96, h=96):
    im = lacquer(w, h, 12, 2)
    d = ImageDraw.Draw(im)
    W, H = w * SS, h * SS
    col, col2 = (GOLD_DK, (110, 86, 46)) if pressed else (GOLD, GOLD_LT)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 12 * SS, outline=col + (255,), width=2 * SS)
    if pressed:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((5 * SS, 5 * SS, W - 5 * SS, H - 5 * SS), 9 * SS, fill=(0, 0, 0, 90))
        im = Image.alpha_composite(im, sh)
        d = ImageDraw.Draw(im)
    else:
        d.line((10 * SS, 7 * SS, W - 10 * SS, 7 * SS), fill=col2 + (170,), width=SS)                                         # 윗면 하이라이트
    return finish(im, w, h)


def divider(w=256, h=8):
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 3 * SS, W, 4 * SS + SS // 2), fill=GOLD + (255,))
    d.rectangle((0, 5 * SS, W, 5 * SS + SS // 2), fill=GOLD_DK + (200,))
    for x in range(16, w, 32):
        diamond(d, x * SS, 4 * SS, 2 * SS, GOLD_LT + (255,))
    return finish(im, w, h)


def flag(w=64, h=64):
    """흰색 한 겹 깃발 — 웹이 세력색으로 곱한다. 천은 흰색·옅은 회색 주름, 장대는 밝은 회색."""
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((9 * SS, 3 * SS, 11.5 * SS, 62 * SS), fill=(205, 205, 205, 255))
    d.ellipse((7.5 * SS, 1 * SS, 13 * SS, 6.5 * SS), fill=(235, 235, 235, 255))
    pts_top = [(11.5 * SS + i * 2 * SS, (6 + 2.2 * __import__('math').sin(i * 0.55)) * SS) for i in range(0, 25)]
    pts_bot = [(x, y + 24 * SS - (i % 2) * 0) for i, (x, y) in enumerate(pts_top)]
    d.polygon(pts_top + list(reversed(pts_bot)), fill=(255, 255, 255, 255))
    for i in range(1, 24, 4):                                                                       # 주름 그림자
        d.line((pts_top[i][0], pts_top[i][1], pts_bot[i][0], pts_bot[i][1]), fill=(224, 224, 224, 255), width=SS)
    return finish(im, w, h)


def pick_size(txt, path, maxw, maxh, fmt):
    lo, hi = 8, 400
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(path, mid)
        b = f.getbbox(txt)
        if b[2] - b[0] <= maxw and b[3] - b[1] <= maxh:
            lo = mid
        else:
            hi = mid - 1
    return lo


def cmap_of(path):
    from fontTools.ttLib import TTFont
    return set(TTFont(path, fontNumber=0).getBestCmap().keys())


def province_labels():
    brush = os.path.join(FONTS, 'NanumBrushScript-Regular.ttf')
    serif = os.path.join(FONTS, 'NotoSerifKR.ttf')
    cm = cmap_of(brush)
    n = 0
    for key, name in provinces():
        W, H = 256 * SS, 96 * SS
        runs = []                                                                    # (글자들, 글꼴 경로) — 붓에 없는 글자는 명조 줄
        for ch in name:
            p = brush if ord(ch) in cm else serif
            if runs and runs[-1][1] == p:
                runs[-1][0] += ch
            else:
                runs.append([ch, p])
        size = pick_size(name, brush, 236 * SS, 74 * SS, None)
        fonts = []
        for txt, p in runs:
            f = ImageFont.truetype(p, size if p == brush else int(size * 0.74))                 # 한자는 붓 글자보다 작게(명조가 더 커 보인다)
            if p == serif:
                try:
                    f.set_variation_by_axes([600])
                except Exception:
                    pass
            fonts.append((txt, f))
        total = sum(f.getlength(t) for t, f in fonts)
        while total > 236 * SS and size > 20:
            size -= 4
            fonts = [(t, ImageFont.truetype(p, size if p == brush else int(size * 0.74))) for (t, _), (_, p) in zip(fonts, runs)]
            total = sum(f.getlength(t) for t, f in fonts)
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = (W - total) / 2
        bf = ImageFont.truetype(brush, size)
        asc, desc = bf.getmetrics()
        base = (H - (asc + desc)) / 2 + asc                                             # 공통 기준선(붓 글자 기준)
        for t, f in fonts:
            d.text((x, base), t, font=f, fill=INK + (255,), anchor='ls')
            x += f.getlength(t)
        alpha = im.getchannel('A').filter(ImageFilter.GaussianBlur(0.6 * SS))
        im.putalpha(alpha.point(lambda v: min(255, int(v * 1.15))))
        im = im.resize((256, 96), Image.LANCZOS)
        save(im, f'prov_{key}.png', lic={'license': 'CC0-1.0 코드 배치 + 글꼴 SIL OFL-1.1 (Nanum Brush Script·Noto Serif KR)', 'text': name,
                                          'fonts': ['Nanum Brush Script (NHN, OFL)', 'Noto Serif KR (Google, OFL)']})
        n += 1
    print('지방 글씨', n)


def build_ui():
    save(panel(), 'ui_panel_lacquer.png', lic={'nine_slice': {'corner_px': 32}, 'size': [192, 192]})
    save(banner(), 'ui_banner_frame.png', lic={'three_slice': {'end_px': 72}, 'size': [384, 72]})
    save(button(False), 'ui_btn_frame.png', lic={'nine_slice': {'corner_px': 24}, 'state': 'normal'})
    save(button(True), 'ui_btn_frame_pressed.png', lic={'nine_slice': {'corner_px': 24}, 'state': 'pressed'})
    save(divider(), 'ui_divider_gold.png', lic={'repeat': 'x', 'size': [256, 8]})
    save(flag(), 'castle_flag.png', lic={'tint': '웹이 세력색으로 곱한다(흰색 한 겹)', 'size': [64, 64]})
    province_labels()


def fetch_fonts():
    os.makedirs(FONTS, exist_ok=True)
    for name, url in FONT_URLS.items():
        p = os.path.join(FONTS, name)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            urllib.request.urlretrieve(url, p)
        print(name, os.path.getsize(p))


def subset_chars():
    """자주 쓰는 글자 = 성·세력·지방 이름 + 전략 화면 코드(cpanel·map2d·hud)에 나오는 글자 + ASCII."""
    chars = set(chr(c) for c in range(32, 127))
    names = open(os.path.join(REALM_JS, 'data-city.js'), encoding='utf-8').read() + open(os.path.join(REALM_JS, 'data-force.js'), encoding='utf-8').read()
    for m in re.finditer(r"\b(?:name|hanja|label|title|lord)\s*:\s*'([^']*)'", names):
        chars.update(m.group(1))
    for key, name in provinces():
        chars.update(name)
    for fn in ('cpanel.js', 'map2d.js', 'hud.js'):
        p = os.path.join(REALM_JS, fn)
        if os.path.exists(p):
            txt = open(p, encoding='utf-8').read()
            chars.update(c for c in txt if ord(c) > 127 and not ('　' <= c <= '〿') or c in '·—…')
    chars.update('·—…×↑↓←→★☆○●◆◇「」『』()（）')
    return ''.join(sorted(chars))


def build_woff2():
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    src = os.path.join(FONTS, 'NotoSerifKR.ttf')
    f = TTFont(src)
    f = instancer.instantiateVariableFont(f, {'wght': 600})
    chars = subset_chars()
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['kern', 'liga']
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opt.notdef_outline = True
    sub = subset.Subsetter(opt)
    sub.populate(text=chars)
    sub.subset(f)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, 'strategy-serif.woff2')
    f.flavor = 'woff2'
    f.save(p)
    kb = os.path.getsize(p) / 1024
    json.dump({'id': 'strategy-serif', 'generator': 'tools/ai-art/make_realm_ui.py woff2', 'font': 'Noto Serif KR (Google Fonts) wght 600 부분 서브셋',
               'license': 'SIL Open Font License 1.1 (OFL-NotoSerif.txt)', 'glyph_chars': len(chars), 'kb': round(kb, 1)},
              open(os.path.join(OUT, 'strategy-serif.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'woff2 {kb:.0f}KB · 글자 {len(chars)}')
    if kb > 200:
        raise SystemExit('200KB 초과 — 글자 줄이기')


CASTLE = {
    's': 'small fortified village outpost, wooden palisade walls, one small watchtower, thatched roofs, no flags, no banners',
    'm': 'medium stone castle, towers and curtain wall, tiled roofs, central keep, no flags, no banners',
    'l': 'grand walled fortress city, tall multi-layered stone ramparts, many towers, large palace roofs, no flags, no banners',
}
STYLE = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single object'
NEG = ('lowres, bad anatomy, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, gradient background, '
       'background scenery, multiple views, border, frame, human, person, people, flag, banner')


def castle_init():
    """밑그림 콜라주 — 정본 지물 스프라이트(성벽·망루·전각·오두막·울타리)를 등각 자리에 놓은 768 흰 배경. 소=마을 요새·중=성·대=대성곽."""
    sp = os.path.join(ROOT, 'saga-assets', 'world', 'sprite')
    cache = {}

    def get(i, scale):
        key = (i, scale)
        if key not in cache:
            im = Image.open(os.path.join(sp, i + '.webp')).convert('RGBA')
            bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
            im = im.crop(bb)
            cache[key] = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        return cache[key]

    def build(plan, name, span, k=1.0):
        cv = Image.new('RGBA', (768, 768), (255, 255, 255, 255))
        items = []
        for (i, gx, gy, sc) in plan:                       # 등각: 화면 x = (gx - gy) * span, y = (gx + gy) * span / 2
            sx = 384 + (gx - gy) * span
            sy = 470 + (gx + gy) * span / 2
            items.append((sy, i, sx, sc))
        for sy, i, sx, sc in sorted(items):
            im = get(i, sc * k)
            cv.alpha_composite(im, (round(sx - im.width / 2), round(sy - im.height)))
        os.makedirs(os.path.join(HERE, '_out', 'realm_castle_init'), exist_ok=True)
        cv.convert('RGB').save(os.path.join(HERE, '_out', 'realm_castle_init', name + '.png'))
    W, T, H, C, F, Q = 'city_wall_segment_01', 'stone_tower_01', 'chinese_hall_01', 'forest_cottage_01', 'wood_fence_01', 'inn_01'
    build([(F, -1.2, -1.2, 0.9), (F, 0.0, -1.5, 0.9), (F, 1.2, -1.2, 0.9), (F, -1.5, 0.0, 0.9), (F, 1.5, 0.0, 0.9), (F, -1.2, 1.2, 0.9), (F, 1.2, 1.2, 0.9),
           (C, -0.4, -0.2, 0.95), (C, 0.5, 0.4, 0.9), (T, 0.0, 0.0, 0.8)], 'castle_s', 70, 0.8)
    build([(W, -1.5, -1.5, 0.95), (W, 0.0, -1.7, 0.95), (W, 1.5, -1.5, 0.95), (W, -1.7, 0.0, 0.95), (W, 1.7, 0.0, 0.95), (W, -1.5, 1.5, 0.95), (W, 0.0, 1.7, 0.95), (W, 1.5, 1.5, 0.95),
           (T, -1.7, -1.7, 0.85), (T, 1.7, -1.7, 0.85), (T, -1.7, 1.7, 0.85), (T, 1.7, 1.7, 0.85), (H, 0.0, 0.0, 1.05)], 'castle_m', 58, 0.58)
    build([(W, -2.0, -2.0, 0.85), (W, 0.0, -2.2, 0.85), (W, 2.0, -2.0, 0.85), (W, -2.2, 0.0, 0.85), (W, 2.2, 0.0, 0.85), (W, -2.0, 2.0, 0.85), (W, 0.0, 2.2, 0.85), (W, 2.0, 2.0, 0.85),
           (W, -1.0, -1.0, 0.6), (W, 1.0, -1.0, 0.6), (W, -1.0, 1.0, 0.6), (W, 1.0, 1.0, 0.6),
           (T, -2.2, -2.2, 0.8), (T, 2.2, -2.2, 0.8), (T, -2.2, 2.2, 0.8), (T, 2.2, 2.2, 0.8), (T, 0.0, -2.2, 0.7), (T, -2.2, 0.0, 0.7),
           (Q, -0.6, 0.5, 0.6), (Q, 0.6, -0.5, 0.6), (H, 0.0, 0.0, 1.1)], 'castle_l', 50, 0.5)
    print('밑그림 3')


def castle_batch():
    items = []
    for k, subj in CASTLE.items():
        for c in (1, 2):
            sd = int(hashlib.md5(f'castle:{k}:{c}'.encode()).hexdigest()[:8], 16)
            items.append({'id': f'castle_{k}_{c}', 'seed': sd, 'prompt': f'{subj}, three-quarter view from above, {STYLE}', 'negative': NEG,
                          'init_image': os.path.join(HERE, '_out', 'realm_castle_init', f'castle_{k}.png'), 'denoise': 0.6 + 0.04 * (c - 1),
                          'meta': {'mode': 'img2img', 'init_image': f'castle_{k}.png (정본 지물 스프라이트 콜라주 밑그림)', 'denoise': 0.6 + 0.04 * (c - 1), 'init_license': 'CC0-1.0 (코드 형태 + Poly Haven CC0 재질) · AI 그림체 B'}})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'realm_castle_i2i',
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
             'items': items}
    p = os.path.join(HERE, 'batches', 'realm_castle.json')
    json.dump(batch, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', p)


def castle_pack():
    sys.path.insert(0, HERE)
    from matte_util import matte2
    picks = json.load(open(os.path.join(HERE, '_out', 'realm_castle_picks.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, '_out', 'realm_castle_picks.json')) else {'s': 1, 'm': 1, 'l': 1}
    for k in 'sml':
        src = os.path.join(HERE, '_out', 'realm_castle_i2i', f'castle_{k}_{picks.get(k, 1)}.png')
        im = matte2(Image.open(src), tol=9, holes_max=7000)
        bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        c = im.crop(bb)
        kf = 120 / max(c.size)
        c = c.resize((max(1, round(c.width * kf)), max(1, round(c.height * kf))), Image.LANCZOS)
        cv = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        cv.alpha_composite(c, ((128 - c.width) // 2, 128 - 4 - c.height))
        lp = os.path.join(HERE, '_out', 'realm_castle_i2i', f'castle_{k}_{picks.get(k, 1)}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': f'castle_{k}', 'packed_by': 'tools/ai-art/make_realm_ui.py castle-pack', 'picked_candidate': picks.get(k, 1), 'flag': '깃발은 뺀 몸체'})
        save(cv, f'castle_{k}.webp', fmt='WEBP', lic=lic)
    print('성 아이콘 3')


def check():
    need = ['ui_panel_lacquer.png', 'ui_banner_frame.png', 'ui_btn_frame.png', 'ui_btn_frame_pressed.png', 'ui_divider_gold.png', 'castle_flag.png',
            'castle_s.webp', 'castle_m.webp', 'castle_l.webp', 'strategy-serif.woff2'] + [f'prov_{k}.png' for k, _ in provinces()]
    bad = []
    for n in need:
        p = os.path.join(OUT, n)
        if not os.path.exists(p):
            bad.append('없음 ' + n)
            continue
        if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
            bad.append('license 없음 ' + n)
    sizes = {'ui_panel_lacquer.png': (192, 192), 'ui_banner_frame.png': (384, 72), 'ui_btn_frame.png': (96, 96), 'ui_btn_frame_pressed.png': (96, 96),
             'ui_divider_gold.png': (256, 8), 'castle_flag.png': (64, 64), 'castle_s.webp': (128, 128), 'castle_m.webp': (128, 128), 'castle_l.webp': (128, 128)}
    for k, _ in provinces():
        sizes[f'prov_{k}.png'] = (256, 96)
    for n, sz in sizes.items():
        p = os.path.join(OUT, n)
        if os.path.exists(p) and Image.open(p).size != sz:
            bad.append(f'크기 {n} {Image.open(p).size} != {sz}')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if not f.endswith('.json')) / 1048576
    print(f'파일 {len(need)} · 합계 {total:.2f}MB (≤3MB)')
    if total > 3:
        bad.append('3MB 초과')
    print('REALMUI_FAIL' if bad else 'REALMUI_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'fonts':
        fetch_fonts()
    elif cmd == 'ui':
        build_ui()
    elif cmd == 'woff2':
        build_woff2()
    elif cmd == 'castle-init':
        castle_init()
    elif cmd == 'castle-batch':
        castle_batch()
    elif cmd == 'castle-pack':
        castle_pack()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
