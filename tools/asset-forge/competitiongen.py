"""K-0050 — 경쟁 시스템 에셋(온라인 없는 경쟁용): 랭크 뱃지 8 · 순위 메달 3 · 시즌 보상 아이콘 12 · 순위표 행 틀 2 · 도전 배너 3 · 라이벌 틀·이름표 + 아레나 배경(AI) 5.

  py tools/asset-forge/competitiongen.py ui             # 뱃지·메달·아이콘·행 틀·배너·라이벌 틀(코드 생성) → _out/competition/
  py tools/asset-forge/competitiongen.py arena-batch    # 아레나 배경 AI 배치 → tools/ai-art/batches/arena.json (gen.py, Illustrious 1216×608, 후보 2)
  py tools/asset-forge/competitiongen.py arena-pack     # 고른 후보(_out/arena_picks.json, 없으면 #1) → 1536×768 webp
  py tools/asset-forge/competitiongen.py check          # 표 항목 수 = 산출 수 · 글자 대비 · 용량(≤2MB) · .license.json 100%

랭크 이름은 가명 — 문장(紋章) 모양만 있고 글자가 없다. 배너 글씨는 OFL 붓글씨체로 굽는다(글꼴은 `py tools/ai-art/make_realm_ui.py fonts` 로 받는다 — 로컬 `_out/fonts`).
경쟁 규칙·점수·저장은 각 판 갈래, 여기는 그림만. 원작 랭크·로고·실존 대회 모사 금지.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'competition')
FONTS = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'fonts')
SS = 4
TIERS = [('bronze', (176, 112, 62), 1), ('silver', (196, 202, 212), 2), ('gold', (232, 190, 72), 3), ('platinum', (170, 226, 228), 4),
         ('sapphire', (80, 140, 236), 5), ('ruby', (222, 70, 90), 6), ('obsidian', (86, 78, 110), 7), ('celestial', (255, 236, 170), 8)]
MEDALS = [('1', (240, 196, 70)), ('2', (200, 206, 216)), ('3', (192, 124, 70))]
REWARDS = ['cup', 'crown', 'gem', 'chest', 'star', 'shield', 'blades', 'scroll', 'coinbag', 'feather', 'flame', 'key']
ARENAS = [('go', 'open tournament arena in a mixed era town square, stone ring, banners without markings, hover lanterns, crowd seats, golden afternoon light'),
          ('dungeon', 'underground stone gladiator pit, iron gates, torches, sand floor, carved pillars, dramatic red light'),
          ('forest', 'cozy village festival duel ring on a meadow, paper lanterns, wooden fence, bunting, soft sunset light'),
          ('story', 'side view floating battle platform arena with banners, glowing runes on the floor, sky background'),
          ('realm', 'grand palace courtyard duel ground, stone tiles, tall flag poles without markings, pavilions, misty dawn')]


def lerp(a, b, t):
    return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))


def shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


def metal(size, base, shape):
    """shape(draw) 로 그린 모양 마스크에 위 밝고 아래 어두운 금속 그라디언트를 씌운다."""
    W = size * SS
    m = Image.new('L', (W, W), 0)
    shape(ImageDraw.Draw(m), W)
    g = Image.new('RGBA', (W, W))
    px = g.load()
    for y in range(W):
        c = lerp(shade(base, 1.25), shade(base, 0.62), y / (W - 1)) + (255,)
        for x in range(W):
            px[x, y] = c
    g.putalpha(m)
    return g


def badge_shape(d, W):
    cx, top, bot, half = W / 2, W * 0.06, W * 0.94, W * 0.40
    d.polygon([(cx, top), (cx + half, top + W * 0.14), (cx + half, bot - W * 0.34), (cx, bot), (cx - half, bot - W * 0.34), (cx - half, top + W * 0.14)], fill=255)


def rank_badge(name, col, n):
    S = 128
    W = S * SS
    base = metal(S, col, badge_shape)
    d = ImageDraw.Draw(base)
    cx = W / 2
    dark = shade(col, 0.4)
    d.line([(cx, W * 0.1), (cx + W * 0.34, W * 0.23), (cx + W * 0.34, W * 0.6), (cx, W * 0.88), (cx - W * 0.34, W * 0.6), (cx - W * 0.34, W * 0.23), (cx, W * 0.1)], fill=dark + (255,), width=int(2.2 * SS), joint='curve')
    for i in range(min(n, 4)):                                                           # 갈매기 줄(등급 따라 늘어남)
        y = W * (0.34 + 0.1 * i)
        d.line([(cx - W * 0.2, y + W * 0.05), (cx, y - W * 0.03), (cx + W * 0.2, y + W * 0.05)], fill=shade(col, 1.45) + (255,), width=int(4 * SS))
    if n >= 5:
        for k in range(n - 4):                                                           # 윗별
            x = cx + (k - (n - 5) / 2) * W * 0.14
            r = W * 0.045
            d.polygon([(x, W * 0.13 - r), (x + r * 0.4, W * 0.13), (x + r, W * 0.13), (x + r * 0.5, W * 0.13 + r * 0.5), (x + r * 0.7, W * 0.13 + r * 1.3), (x, W * 0.13 + r * 0.8), (x - r * 0.7, W * 0.13 + r * 1.3), (x - r * 0.5, W * 0.13 + r * 0.5), (x - r, W * 0.13), (x - r * 0.4, W * 0.13)], fill=(255, 250, 220, 255))
    d.ellipse((cx - W * 0.07, W * 0.57 - W * 0.07, cx + W * 0.07, W * 0.57 + W * 0.07), fill=shade(col, 1.6) + (255,))
    if n == 8:
        base = Image.alpha_composite(base.filter(ImageFilter.GaussianBlur(4 * SS)), base)
    return base.resize((S, S), Image.LANCZOS)


def medal(label, col):
    S = 128
    W = S * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for sx in (-1, 1):                                                                    # 리본
        d.polygon([(W / 2 + sx * W * 0.08, 0), (W / 2 + sx * W * 0.26, 0), (W / 2 + sx * W * 0.14, W * 0.5), (W / 2 + sx * W * 0.0, W * 0.5)], fill=(190, 50, 60, 255) if sx < 0 else (60, 90, 190, 255))
    cy = W * 0.62
    for r, f in ((W * 0.34, 0.7), (W * 0.30, 1.0), (W * 0.24, 0.8)):
        d.ellipse((W / 2 - r, cy - r, W / 2 + r, cy + r), fill=shade(col, f) + (255,))
    f = ImageFont.truetype(os.path.join(FONTS, 'NotoSerifKR.ttf'), int(W * 0.3)) if os.path.exists(os.path.join(FONTS, 'NotoSerifKR.ttf')) else ImageFont.load_default()
    try:
        f.set_variation_by_axes([800])
    except Exception:
        pass
    d.text((W / 2, cy), label, font=f, fill=shade(col, 0.4) + (255,), anchor='mm')
    return im.resize((S, S), Image.LANCZOS)


def reward_icon(kind):
    S = 128
    W = S * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gold, dk, lt = (232, 190, 72), (140, 100, 36), (255, 236, 160)
    p = lambda x, y: (x * W / 128, y * W / 128)
    if kind == 'cup':
        d.polygon([p(36, 30), p(92, 30), p(84, 68), p(64, 82), p(44, 68)], fill=gold)
        for sx in (36, 92):
            d.arc((p(sx - 20, 34)[0], p(0, 34)[1], p(sx + 20, 0)[0], p(0, 68)[1]), 90 if sx == 36 else -90, 270 if sx == 36 else 90, fill=dk, width=int(5 * SS))
        d.rectangle((*p(58, 80), *p(70, 98)), fill=dk)
        d.rectangle((*p(42, 98), *p(86, 108)), fill=gold)
        d.polygon([p(44, 34), p(56, 34), p(52, 62), p(46, 60)], fill=lt)
    elif kind == 'crown':
        d.polygon([p(22, 90), p(22, 44), p(46, 66), p(64, 30), p(82, 66), p(106, 44), p(106, 90)], fill=gold)
        d.rectangle((*p(22, 90), *p(106, 102)), fill=dk)
        for x, c in ((46, (230, 60, 80)), (64, (80, 140, 240)), (82, (230, 60, 80))):
            d.ellipse((*p(x - 6, 78), *p(x + 6, 90)), fill=c)
    elif kind == 'gem':
        d.polygon([p(40, 34), p(88, 34), p(108, 58), p(64, 108), p(20, 58)], fill=(90, 190, 240))
        d.polygon([p(40, 34), p(64, 58), p(20, 58)], fill=(150, 225, 255))
        d.polygon([p(88, 34), p(108, 58), p(64, 58)], fill=(60, 140, 210))
        d.polygon([p(20, 58), p(64, 58), p(64, 108)], fill=(70, 160, 225))
    elif kind == 'chest':
        d.rectangle((*p(20, 60), *p(108, 104)), fill=(140, 90, 52))
        d.pieslice((*p(20, 26), *p(108, 94)), 180, 360, fill=(170, 110, 62))
        for x in (36, 88):
            d.rectangle((*p(x - 4, 36), *p(x + 4, 104)), fill=(70, 70, 80))
        d.rectangle((*p(56, 62), *p(72, 82)), fill=gold)
    elif kind == 'star':
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            r = 46 if i % 2 == 0 else 20
            pts.append(p(64 + math.cos(a) * r, 66 + math.sin(a) * r))
        d.polygon(pts, fill=gold, outline=dk)
    elif kind == 'shield':
        d.polygon([p(24, 28), p(104, 28), p(104, 64), p(64, 108), p(24, 64)], fill=(90, 130, 200))
        d.polygon([p(64, 28), p(104, 28), p(104, 64), p(64, 108)], fill=(70, 105, 175))
        d.line([p(64, 36), p(64, 98)], fill=lt, width=int(5 * SS))
        d.line([p(34, 52), p(94, 52)], fill=lt, width=int(5 * SS))
    elif kind == 'blades':
        for sx in (-1, 1):
            d.polygon([p(64 + sx * 10, 100), p(64 + sx * 6, 100), p(64 + sx * 34, 24), p(64 + sx * 42, 28)], fill=(200, 208, 220))
            d.rectangle((*p(64 + sx * 30 - 12, 84), *p(64 + sx * 30 + 12, 90)), fill=dk)
    elif kind == 'scroll':
        d.rectangle((*p(34, 28), *p(94, 100)), fill=(236, 222, 186))
        for y in (44, 58, 72):
            d.line([p(44, y), p(84, y)], fill=(150, 120, 80), width=int(3 * SS))
        for y in (28, 100):
            d.rectangle((*p(28, y - 5), *p(100, y + 5)), fill=(190, 150, 90))
    elif kind == 'coinbag':
        d.ellipse((*p(30, 44), *p(98, 108)), fill=(150, 112, 70))
        d.polygon([p(50, 46), p(78, 46), p(70, 30), p(58, 30)], fill=(150, 112, 70))
        d.rectangle((*p(52, 42), *p(76, 48)), fill=(110, 80, 50))
        d.ellipse((*p(52, 62), *p(76, 86)), fill=gold)
    elif kind == 'feather':
        d.polygon([p(30, 100), p(40, 80), p(88, 22), p(104, 30), p(98, 62), p(56, 98)], fill=(230, 240, 250))
        d.line([p(30, 102), p(100, 28)], fill=(150, 170, 200), width=int(3 * SS))
    elif kind == 'flame':
        d.polygon([p(64, 18), p(88, 52), p(94, 80), p(78, 104), p(50, 104), p(34, 80), p(44, 52), p(54, 62)], fill=(240, 120, 40))
        d.polygon([p(64, 50), p(80, 76), p(74, 98), p(54, 98), p(48, 76)], fill=(255, 200, 80))
    else:                                                                                 # key
        d.ellipse((*p(30, 24), *p(70, 64)), outline=gold, width=int(9 * SS))
        d.rectangle((*p(62, 40), *p(104, 50)), fill=gold)
        d.rectangle((*p(88, 50), *p(96, 66)), fill=gold)
        d.rectangle((*p(74, 50), *p(82, 62)), fill=gold)
    sh = im.filter(ImageFilter.GaussianBlur(3 * SS))
    out = Image.alpha_composite(Image.new('RGBA', (W, W), (0, 0, 0, 0)), im)
    shadow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), mask=sh.getchannel('A').point(lambda v: v // 2))
    return Image.alpha_composite(shadow, out).resize((S, S), Image.LANCZOS)


def row_frame(me):
    w, h = 480, 56
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fill = (60, 52, 30, 235) if me else (28, 30, 40, 215)
    edge = (240, 200, 90, 255) if me else (120, 130, 150, 255)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 14 * SS, fill=fill, outline=edge, width=int((3 if me else 2) * SS))
    d.line((56 * SS, 10 * SS, 56 * SS, (h - 10) * SS), fill=edge[:3] + (140,), width=SS)
    return im.resize((w, h), Image.LANCZOS)


def banner(text, col):
    w, h = 256, 72
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(10 * SS, 8 * SS), ((w - 10) * SS, 8 * SS), ((w - 2) * SS, H / 2), ((w - 10) * SS, (h - 8) * SS), (10 * SS, (h - 8) * SS), (2 * SS, H / 2)], fill=shade(col, 0.45) + (245,), outline=col + (255,))
    d.line((14 * SS, 13 * SS, (w - 14) * SS, 13 * SS), fill=shade(col, 1.3) + (255,), width=SS)
    d.line((14 * SS, (h - 13) * SS, (w - 14) * SS, (h - 13) * SS), fill=shade(col, 1.3) + (255,), width=SS)
    fp = os.path.join(FONTS, 'NanumBrushScript-Regular.ttf')
    if not os.path.exists(fp):
        raise SystemExit('글꼴 없음 — py tools/ai-art/make_realm_ui.py fonts')
    size = 140
    f = ImageFont.truetype(fp, size)
    while f.getlength(text) > (w - 60) * SS * 0.95 and size > 20:
        size -= 6
        f = ImageFont.truetype(fp, size)
    d.text((W / 2, H / 2 + 2 * SS), text, font=f, fill=(250, 244, 226, 255), anchor='mm')
    return im.resize((w, h), Image.LANCZOS)


def rival_frame():
    w, h = 144, 176
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gold, red = (232, 190, 72, 255), (200, 60, 70, 255)
    d.rounded_rectangle((3 * SS, 3 * SS, W - 3 * SS - 1, H - 3 * SS - 1), 14 * SS, outline=red, width=int(4 * SS))
    d.rounded_rectangle((10 * SS, 10 * SS, W - 10 * SS - 1, H - 10 * SS - 1), 9 * SS, outline=gold, width=int(1.6 * SS))
    for cx, cy in ((12, 12), (w - 12, 12), (12, h - 12), (w - 12, h - 12)):
        d.polygon([(cx * SS, (cy - 7) * SS), ((cx + 7) * SS, cy * SS), (cx * SS, (cy + 7) * SS), ((cx - 7) * SS, cy * SS)], fill=gold)
    d.polygon([((w / 2 - 14) * SS, 0), ((w / 2 + 14) * SS, 0), (w / 2 * SS, 14 * SS)], fill=red)
    return im.resize((w, h), Image.LANCZOS)


def nameplate():
    w, h = 192, 40
    W, H = w * SS, h * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2 * SS, 2 * SS, W - 2 * SS - 1, H - 2 * SS - 1), 10 * SS, fill=(34, 24, 28, 235), outline=(200, 60, 70, 255), width=int(2.5 * SS))
    for sx in (14, w - 14):
        d.polygon([(sx * SS, (h / 2 - 6) * SS), ((sx + 6) * SS, h / 2 * SS), (sx * SS, (h / 2 + 6) * SS), ((sx - 6) * SS, h / 2 * SS)], fill=(232, 190, 72, 255))
    return im.resize((w, h), Image.LANCZOS)


def save(im, name, extra=None, fmt='PNG'):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=88, method=6) if fmt == 'WEBP' else im.save(p, optimize=True)
    d = {'id': os.path.splitext(name)[0], 'generator': 'tools/asset-forge/competitiongen.py', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)', 'size': list(im.size)}
    d.update(extra or {})
    json.dump(d, open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def build_ui():
    for name, col, n in TIERS:
        save(rank_badge(name, col, n), f'rank_badge_{n}_{name}.png', {'tier': n, 'tier_key': name, 'note': '가명 랭크 — 문장 모양만(글자 없음)'})
    for label, col in MEDALS:
        save(medal(label, col), f'medal_{label}.png', {'place': int(label)})
    for k in REWARDS:
        save(reward_icon(k), f'reward_{k}.png', {'kind': k})
    save(row_frame(False), 'rank_row.png', {'nine_slice': 16})
    save(row_frame(True), 'rank_row_me.png', {'nine_slice': 16})
    for key, text, col in (('daily', '일일 도전', (96, 190, 120)), ('weekly', '주간 도전', (96, 150, 230)), ('season', '시즌 도전', (230, 170, 70))):
        save(banner(text, col), f'banner_{key}.png', {'text': text, 'font': 'Nanum Brush Script (OFL)'})
    save(rival_frame(), 'rival_frame.png', {'nine_slice': 20})
    save(nameplate(), 'rival_nameplate.png', {'nine_slice': 16})
    sheet()
    print('경쟁 UI', len(TIERS) + len(MEDALS) + len(REWARDS) + 2 + 3 + 2, '→', OUT)


def sheet():
    S = Image.new('RGB', (1100, 520), (70, 74, 84))
    x = y = 8
    for name, col, n in TIERS:
        im = Image.open(os.path.join(OUT, f'rank_badge_{n}_{name}.png')).convert('RGBA')
        S.paste(im, (8 + (n - 1) * 130, 8), im)
    for i, (label, col) in enumerate(MEDALS):
        im = Image.open(os.path.join(OUT, f'medal_{label}.png')).convert('RGBA')
        S.paste(im, (8 + i * 130, 140), im)
    for i, k in enumerate(REWARDS):
        im = Image.open(os.path.join(OUT, f'reward_{k}.png')).convert('RGBA')
        sm = im.resize((112, 112))
        S.paste(sm, (400 + (i % 6) * 120, 140 + (i // 6) * 120), sm)
    for i, n in enumerate(('banner_daily', 'banner_weekly', 'banner_season')):
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA')
        S.paste(im, (8 + i * 264, 280), im)
    for i, n in enumerate(('rank_row', 'rank_row_me')):
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA')
        S.paste(im, (8, 366 + i * 60), im)
    for n, pos in (('rival_frame', (520, 366)), ('rival_nameplate', (680, 420))):
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA')
        S.paste(im, pos, im)
    S.save(os.path.join(OUT, 'competition_sheet.jpg'), quality=88)


def arena_batch():
    items = []
    n = 0
    for gid, prompt in ARENAS:
        for k in (1, 2):
            n += 1
            items.append({'id': f'arena_{gid}_{k}', 'seed': 20271004 + 61 * n, 'prompt': prompt})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'arena',
         'defaults': {'prompt_prefix': 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, wide shot, painterly game background, arena',
                      'width': 1216, 'height': 608, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a',
                      'negative': 'lowres, bad anatomy, text, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, close-up'},
         'items': items}
    p = os.path.join(ROOT, 'tools', 'ai-art', 'batches', 'arena.json')
    json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH arena', len(items), '→', p)


def arena_pack():
    src = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'arena')
    pk = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'arena_picks.json')
    picks = json.load(open(pk, encoding='utf-8')) if os.path.exists(pk) else {}
    for gid, _p in ARENAS:
        k = picks.get(gid, 1)
        sp = os.path.join(src, f'arena_{gid}_{k}.png')
        im = Image.open(sp).convert('RGB').resize((1536, 768), Image.LANCZOS)
        lp = os.path.join(src, f'arena_{gid}_{k}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        save(im, f'arena_{gid}.webp', {**lic, 'id': f'arena_{gid}', 'game': gid, 'picked_candidate': k, 'upscaled_from': [1216, 608]}, fmt='WEBP')
    print('아레나 배경', len(ARENAS))


def check():
    bad = []
    total = 0
    names = [f'rank_badge_{n}_{name}.png' for name, _c, n in TIERS] + [f'medal_{l}.png' for l, _c in MEDALS] + [f'reward_{k}.png' for k in REWARDS] + \
            ['rank_row.png', 'rank_row_me.png', 'banner_daily.png', 'banner_weekly.png', 'banner_season.png', 'rival_frame.png', 'rival_nameplate.png'] + [f'arena_{g}.webp' for g, _p in ARENAS]
    for n in names:
        p = os.path.join(OUT, n)
        if not os.path.exists(p):
            bad.append('없음 ' + n)
            continue
        total += os.path.getsize(p)
        if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
            bad.append('license 없음 ' + n)
    for n in ('banner_daily', 'banner_weekly', 'banner_season'):                                  # 글자 가독성: 흰 글자(250) vs 배너 바탕 대비
        p = os.path.join(OUT, n + '.png')
        if os.path.exists(p):
            a = Image.open(p).convert('RGBA').getpixel((40, 36))
            def L(c):
                f = lambda v: (v / 255 / 12.92) if v / 255 <= 0.03928 else (((v / 255) + 0.055) / 1.055) ** 2.4
                return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
            cr = (L((250, 244, 226)) + 0.05) / (L(a) + 0.05)
            if cr < 4.5:
                bad.append(f'{n} 글자 대비 {cr:.1f} < 4.5')
    mb = total / 1048576
    print(f'경쟁 에셋 {len(names)} · 합계 {mb:.2f}MB (≤2MB)')
    if mb > 2:
        bad.append('용량 2MB 초과')
    print('COMPETITION_FAIL' if bad else 'COMPETITION_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'ui':
        build_ui()
    elif cmd == 'arena-batch':
        arena_batch()
    elif cmd == 'arena-pack':
        arena_pack()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
