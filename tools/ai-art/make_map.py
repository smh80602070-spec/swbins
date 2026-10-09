"""K-0042 — 월드 지도·지역 아이콘: 판별 고정 지역의 이름·특색을 그림으로.

  py tools/ai-art/make_map.py icons        # 지역 아이콘 64px 알파(코드 그림 — 틀 + 상징) → _out/map/icons/<판>_<지역>.png
  py tools/ai-art/make_map.py batch        # 월드 지도 일러스트 AI 배치 → batches/map.json (판마다 후보 3, Illustrious 1056×704, 글씨 없음)
  py tools/ai-art/make_map.py pack [picks] # 고른 후보 → 1536×1024 webp (_out/map/map_<판>.webp) · picks = _out/map_picks.json({"go":1,..}, 없으면 #1)
  py tools/ai-art/make_map.py check        # 지역 수 = 아이콘 수 · 크기 · .license.json 100% · 지도 5장

지역 목록은 판의 데이터를 읽는다 — dungeon `world-map.js` REGIONS 9 · forest `village.js` FORESTS 8 · go `biome.js` BIOMES 6 · story `data-side.js` STAGES 앞 14(마을·사냥터)
· realm `data-city.js` PROVINCES 28. 실제 지명·국기·실존 문장 금지 — 프롬프트는 땅의 특색만 쓰고 지도 그림에 글씨는 넣지 않는다(이름·좌표는 게임이 얹는다).
"""
import json
import math
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'map')
SS = 4
W_ = os.path.join(ROOT, 'saga-web')


def read(p):
    return open(os.path.join(W_, p), encoding='utf-8').read()


def regions():
    R = {}
    s = read('saga-dungeon/js/world-map.js')
    R['dungeon'] = [(m.group(1), m.group(2)) for m in re.finditer(r"\{ key: '(\w+)', name: '([^']+)', hanja", s[s.index('var REGIONS'):])][:9]
    s = read('saga-forest/js/village.js')
    R['forest'] = [(m.group(1), m.group(2), m.group(3)) for m in re.finditer(r"\{ key: '(\w+)', name: '([^']+)', hanja: '[^']*', emoji: '[^']*', biome: '(\w+)'", s[s.index('var FORESTS'):])][:8]
    s = read('saga-go/js/biome.js')
    R['go'] = [(m.group(1), m.group(2)) for m in re.finditer(r"(\w+):\s*\{ key: '\w+',\s*name: '([^']+)'", s[s.index('var BIOMES'):])][:6]
    s = read('saga-story/js/data-side.js')
    st = [(m.group(1), m.group(2)) for m in re.finditer(r"key:\s*'(\w+)'.*?name:\s*'([^']*)'", s[s.index('var STAGES'):], re.S)]
    R['story'] = st[:14]
    s = read('saga-realm/js/data-city.js')
    i = s.index('var PROVINCES = {')
    R['realm'] = re.findall(r"(\w+):\s*'([^']+)'", s[i:s.index('};', i)])
    return R


# 지역 → 상징(코드 그림). 키는 판 데이터의 key.
SYM = {
    'dungeon': {'jungwon': 'wheat', 'neon': 'city', 'saltmarsh': 'wave', 'hellgate': 'flame', 'solar': 'sun', 'silkroad': 'dune', 'heaven': 'cloud', 'snowfort': 'snow', 'scrap': 'gear'},
    'forest': {'eoksae': 'wheat', 'yoseong': 'mushroom', 'solsup': 'pine', 'neoldeol': 'rock', 'eoseureum': 'deadtree', 'kkotip': 'flower', 'georin': 'mountain', 'bandi': 'firefly'},
    'go': {'home': 'house', 'plain': 'wheat', 'bamboo': 'bamboo', 'canyon': 'mountain', 'marsh': 'wave', 'ruins': 'ruin'},
    'story': {'sinya': 'house', 'heodo': 'castle', 'field': 'wheat', 'gangneungjin': 'wave', 'forest': 'pine', 'namjeongseong': 'castle', 'cave': 'cave', 'gisanchae': 'mountain',
              'gorge': 'flame', 'ruin': 'ruin', 'deepcave': 'cave', 'beyond_past': 'sword', 'beyond_now': 'city', 'beyond_future': 'gear'},
    # K-0088: 물가 7칸이 같은 물결이던 것 → 등대·연꽃·배·섬·물고기·산호로 가름(고정·특색 지역)
    'realm': {'you': 'snow', 'ji': 'wheat', 'bing': 'mountain', 'qing': 'lighthouse', 'yan': 'wheat', 'xu': 'wave', 'yu': 'wheat', 'si': 'castle', 'yong': 'mountain', 'liang': 'dune', 'jing': 'lotus',
              'yi': 'pine', 'yang': 'boat', 'kr': 'pine', 'jp': 'island', 'jiao': 'bamboo', 'xi': 'dune', 'nz': 'bamboo', 'tz': 'temple', 'mb': 'snow', 'cp': 'fish', 'fu': 'flame', 'pf': 'ruin',
              'my': 'tomb', 'dj': 'city', 'xb': 'dune', 'nh': 'coral', 'sl': 'dune'},
}
GAME_COLOR = {'go': (127, 216, 208), 'dungeon': (192, 70, 58), 'forest': (232, 216, 160), 'story': (127, 184, 255), 'realm': (216, 181, 106)}
GAME_BG = {'go': (28, 58, 68), 'dungeon': (42, 18, 20), 'forest': (47, 74, 44), 'story': (28, 42, 74), 'realm': (38, 29, 20)}


def symbol(d, kind, c, S):
    """S=64*SS 판 위에 상징을 그린다."""
    p = lambda x, y: (x * S / 64, y * S / 64)
    w = int(3 * SS)
    lt = tuple(min(255, v + 60) for v in c)
    if kind == 'wheat':
        d.line([p(32, 50), p(32, 18)], fill=c, width=w)
        for j in range(5):
            for sx in (-1, 1):
                d.ellipse((*p(32 + sx * 5 - 3, 20 + j * 6), *p(32 + sx * 5 + 3, 26 + j * 6)), fill=c)
        d.ellipse((*p(29, 12), *p(35, 22)), fill=lt)
    elif kind == 'city':
        for x, h in ((14, 20), (24, 30), (34, 24), (44, 34)):
            d.rectangle((*p(x, 50 - h), *p(x + 8, 50)), fill=c)
        for x in (26, 46):
            d.rectangle((*p(x, 24), *p(x + 3, 28)), fill=GAME_BG_NOW)
    elif kind == 'wave':
        for k in range(3):
            y = 24 + k * 10
            d.arc((*p(10, y), *p(28, y + 10)), 200, 340, fill=c, width=w)
            d.arc((*p(26, y), *p(44, y + 10)), 200, 340, fill=c, width=w)
            d.arc((*p(42, y), *p(58, y + 10)), 200, 340, fill=c, width=w)
    elif kind == 'flame':
        d.polygon([p(32, 10), p(44, 28), p(46, 42), p(38, 54), p(26, 54), p(18, 42), p(22, 28), p(28, 32)], fill=c)
        d.polygon([p(32, 30), p(38, 42), p(34, 52), p(28, 52), p(26, 42)], fill=lt)
    elif kind == 'sun':
        d.ellipse((*p(20, 20), *p(44, 44)), fill=c)
        for k in range(10):
            a = k * math.pi / 5
            d.line([p(32 + math.cos(a) * 16, 32 + math.sin(a) * 16), p(32 + math.cos(a) * 26, 32 + math.sin(a) * 26)], fill=c, width=w)
    elif kind == 'dune':
        d.polygon([p(6, 50), p(22, 28), p(34, 42), p(46, 24), p(58, 50)], fill=c)
        d.polygon([p(6, 50), p(22, 36), p(34, 46), p(46, 34), p(58, 50)], fill=lt)
    elif kind == 'cloud':
        for cx, cy, r in ((22, 38, 10), (34, 30, 13), (46, 38, 10)):
            d.ellipse((*p(cx - r, cy - r), *p(cx + r, cy + r)), fill=c)
        d.rectangle((*p(22, 38), *p(46, 48)), fill=c)
    elif kind == 'snow':
        for k in range(6):
            a = k * math.pi / 3
            d.line([p(32, 32), p(32 + math.cos(a) * 24, 32 + math.sin(a) * 24)], fill=c, width=w)
            d.line([p(32 + math.cos(a) * 14, 32 + math.sin(a) * 14), p(32 + math.cos(a + 0.5) * 20, 32 + math.sin(a + 0.5) * 20)], fill=c, width=int(2 * SS))
    elif kind == 'gear':
        d.ellipse((*p(16, 16), *p(48, 48)), fill=c)
        for k in range(8):
            a = k * math.pi / 4
            d.polygon([p(32 + math.cos(a - 0.2) * 20, 32 + math.sin(a - 0.2) * 20), p(32 + math.cos(a - 0.2) * 27, 32 + math.sin(a - 0.2) * 27), p(32 + math.cos(a + 0.2) * 27, 32 + math.sin(a + 0.2) * 27), p(32 + math.cos(a + 0.2) * 20, 32 + math.sin(a + 0.2) * 20)], fill=c)
        d.ellipse((*p(26, 26), *p(38, 38)), fill=GAME_BG_NOW)
    elif kind == 'mushroom':
        d.pieslice((*p(12, 14), *p(52, 50)), 180, 360, fill=c)
        d.rectangle((*p(27, 32), *p(37, 52)), fill=lt)
        for x, y in ((22, 24), (34, 20), (42, 28)):
            d.ellipse((*p(x - 2, y - 2), *p(x + 2, y + 2)), fill=lt)
    elif kind in ('pine', 'bamboo'):
        if kind == 'pine':
            for k in range(3):
                d.polygon([p(32, 8 + k * 12), p(46 - k * 2, 28 + k * 12), p(18 + k * 2, 28 + k * 12)], fill=c)
            d.rectangle((*p(29, 46), *p(35, 56)), fill=lt)
        else:
            for x in (20, 32, 44):
                d.rectangle((*p(x - 2, 10), *p(x + 2, 54)), fill=c)
                for y in (22, 36, 48):
                    d.line([p(x - 3, y), p(x + 3, y)], fill=lt, width=int(1.5 * SS))
    elif kind == 'rock':
        d.polygon([p(10, 50), p(18, 26), p(32, 20), p(46, 28), p(54, 50)], fill=c)
        d.polygon([p(10, 50), p(20, 34), p(30, 36), p(24, 50)], fill=lt)
    elif kind == 'deadtree':
        d.line([p(32, 54), p(32, 20)], fill=c, width=int(4 * SS))
        for a, b in (((32, 40), (18, 28)), ((32, 34), (46, 22)), ((18, 28), (12, 18)), ((46, 22), (52, 14))):
            d.line([p(*a), p(*b)], fill=c, width=int(2.5 * SS))
    elif kind == 'flower':
        for k in range(5):
            a = k * 2 * math.pi / 5 - math.pi / 2
            d.ellipse((*p(32 + math.cos(a) * 11 - 7, 28 + math.sin(a) * 11 - 7), *p(32 + math.cos(a) * 11 + 7, 28 + math.sin(a) * 11 + 7)), fill=c)
        d.ellipse((*p(27, 23), *p(37, 33)), fill=lt)
        d.line([p(32, 36), p(32, 56)], fill=c, width=w)
    elif kind == 'mountain':
        d.polygon([p(6, 52), p(26, 16), p(36, 34), p(44, 24), p(58, 52)], fill=c)
        d.polygon([p(26, 16), p(32, 28), p(26, 26), p(20, 28)], fill=lt)
    elif kind == 'firefly':
        for x, y, r in ((22, 30, 5), (38, 22, 4), (42, 40, 6), (28, 46, 4)):
            d.ellipse((*p(x - r, y - r), *p(x + r, y + r)), fill=lt)
            d.ellipse((*p(x - r * 2, y - r * 2), *p(x + r * 2, y + r * 2)), outline=c, width=SS)
    elif kind == 'house':
        d.polygon([p(10, 32), p(32, 12), p(54, 32)], fill=c)
        d.rectangle((*p(16, 32), *p(48, 52)), fill=lt)
        d.rectangle((*p(28, 40), *p(36, 52)), fill=GAME_BG_NOW)
    elif kind == 'castle':
        d.rectangle((*p(14, 26), *p(50, 54)), fill=c)
        for x in (14, 24, 34, 44):
            d.rectangle((*p(x, 18), *p(x + 6, 28)), fill=c)
        d.pieslice((*p(26, 38), *p(38, 62)), 180, 360, fill=GAME_BG_NOW)
    elif kind == 'cave':
        d.pieslice((*p(8, 14), *p(56, 70)), 180, 360, fill=c)
        d.pieslice((*p(22, 30), *p(42, 70)), 180, 360, fill=GAME_BG_NOW)
    elif kind == 'ruin':
        for x, h in ((12, 26), (26, 36), (40, 20)):
            d.rectangle((*p(x, 52 - h), *p(x + 9, 52)), fill=c)
            d.polygon([p(x, 52 - h), p(x + 9, 52 - h), p(x + 5, 52 - h - 5)], fill=c) if h < 30 else d.rectangle((*p(x - 2, 52 - h - 4), *p(x + 11, 52 - h)), fill=lt)
    elif kind == 'sword':
        d.polygon([p(30, 52), p(34, 52), p(36, 10), p(28, 10)], fill=c)
        d.rectangle((*p(20, 40), *p(44, 45)), fill=lt)
    elif kind == 'temple':
        d.polygon([p(8, 24), p(32, 10), p(56, 24)], fill=c)
        for x in (14, 26, 38, 48):
            d.rectangle((*p(x, 26), *p(x + 4, 52)), fill=lt)
        d.rectangle((*p(10, 52), *p(54, 58)), fill=c)
    elif kind == 'tomb':
        d.pieslice((*p(18, 14), *p(46, 50)), 180, 360, fill=c)
        d.rectangle((*p(18, 32), *p(46, 54)), fill=c)
        d.line([p(32, 24), p(32, 40)], fill=GAME_BG_NOW, width=w)
        d.line([p(26, 30), p(38, 30)], fill=GAME_BG_NOW, width=w)
    elif kind == 'lighthouse':
        d.polygon([p(26, 54), p(38, 54), p(35, 20), p(29, 20)], fill=c)
        d.rectangle((*p(27, 14), *p(37, 20)), fill=lt)
        d.polygon([p(27, 14), p(32, 8), p(37, 14)], fill=c)
        for y in (30, 42):
            d.rectangle((*p(28, y), *p(36, y + 4)), fill=GAME_BG_NOW)
        d.polygon([p(37, 15), p(58, 9), p(58, 21)], fill=lt)
    elif kind == 'lotus':
        def petal(ang, ln, wd, col):
            ax, ay = math.cos(ang), math.sin(ang)
            bx, by = -ay, ax
            d.polygon([p(32, 46), p(32 + ax * ln * 0.5 + bx * wd, 46 + ay * ln * 0.5 + by * wd), p(32 + ax * ln, 46 + ay * ln),
                       p(32 + ax * ln * 0.5 - bx * wd, 46 + ay * ln * 0.5 - by * wd)], fill=col)
        for ang, ln, wd, col in ((-2.75, 20, 6, c), (-0.39, 20, 6, c), (-2.25, 27, 7, lt), (-0.89, 27, 7, lt), (-math.pi / 2, 32, 8, c)):
            petal(ang, ln, wd, col)
        d.pieslice((*p(12, 44), *p(52, 56)), 0, 180, fill=c)
    elif kind == 'boat':
        d.polygon([p(8, 40), p(56, 40), p(48, 52), p(16, 52)], fill=c)
        d.line([p(32, 40), p(32, 10)], fill=c, width=w)
        d.polygon([p(33, 12), p(52, 36), p(33, 36)], fill=lt)
        d.polygon([p(31, 16), p(16, 36), p(31, 36)], fill=lt)
    elif kind == 'island':
        d.pieslice((*p(10, 36), *p(54, 66)), 180, 360, fill=c)
        d.line([p(34, 50), p(32, 36), p(30, 22)], fill=lt, width=int(3 * SS))
        for tx, ty in ((12, 30), (16, 18), (44, 18), (48, 30), (30, 10)):
            mx, my = (30 + tx) / 2, (22 + ty) / 2 - 4
            d.polygon([p(30, 22), p(mx - 2, my - 3), p(tx, ty), p(mx + 2, my + 3)], fill=lt)
        for k in range(2):
            y = 55 + k * 5
            d.line([p(8, y), p(20, y - 2), p(32, y), p(44, y - 2), p(56, y)], fill=c, width=int(2 * SS))
    elif kind == 'fish':
        d.ellipse((*p(12, 22), *p(46, 44)), fill=c)
        d.polygon([p(42, 33), p(58, 20), p(58, 46)], fill=c)
        d.ellipse((*p(18, 28), *p(24, 34)), fill=GAME_BG_NOW)
        d.arc((*p(22, 24), *p(38, 42)), 300, 60, fill=lt, width=int(2 * SS))
    elif kind == 'coral':
        d.line([p(32, 56), p(32, 30)], fill=c, width=int(4 * SS))
        for a, b in (((32, 44), (18, 30)), ((32, 38), (46, 24)), ((18, 30), (14, 16)), ((18, 30), (26, 18)), ((46, 24), (52, 12)), ((32, 30), (34, 14))):
            d.line([p(*a), p(*b)], fill=c, width=int(3 * SS))
        for x, y in ((14, 16), (26, 18), (52, 12), (34, 14)):
            d.ellipse((*p(x - 3, y - 3), *p(x + 3, y + 3)), fill=lt)
    else:
        d.ellipse((*p(16, 16), *p(48, 48)), fill=c)


GAME_BG_NOW = (30, 30, 36)


def make_icon(game, kind):
    global GAME_BG_NOW
    S = 64
    W = S * SS
    c = GAME_COLOR[game]
    bg = GAME_BG[game]
    GAME_BG_NOW = bg
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((2 * SS, 2 * SS, W - 2 * SS - 1, W - 2 * SS - 1), fill=bg + (240,), outline=c + (255,), width=int(3 * SS))
    d.ellipse((7 * SS, 7 * SS, W - 7 * SS - 1, W - 7 * SS - 1), outline=tuple(int(v * 0.6) for v in c) + (255,), width=SS)
    sy = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sy)
    symbol(sd, kind, c, W)
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).ellipse((9 * SS, 9 * SS, W - 9 * SS - 1, W - 9 * SS - 1), fill=255)
    from PIL import ImageChops
    sy.putalpha(ImageChops.multiply(sy.getchannel('A'), mask))
    im = Image.alpha_composite(im, sy)
    return im.resize((S, S), Image.LANCZOS)


def icons():
    R = regions()
    os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
    n = 0
    meta = {}
    for game, rows in R.items():
        for row in rows:
            key, name = row[0], row[1]
            kind = SYM[game].get(key, 'castle' if game == 'story' else 'rock')
            im = make_icon(game, kind)
            fn = f'{game}_{key}.png'
            p = os.path.join(OUT, 'icons', fn)
            im.save(p, optimize=True)
            json.dump({'id': f'{game}_{key}', 'generator': 'tools/ai-art/make_map.py', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)', 'game': game, 'region_key': key, 'symbol': kind, 'size': [64, 64]},
                      open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            meta.setdefault(game, []).append({'key': key, 'name': name, 'symbol': kind})
            n += 1
    json.dump({'note': 'K-0042 지역 아이콘 목록 — 지역 이름은 판 데이터에서 읽은 것(그림에는 글씨 없음)', 'regions': meta}, open(os.path.join(OUT, 'regions.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('지역 아이콘', n, {g: len(v) for g, v in meta.items()})


MAP_PROMPT = {
    'go': 'fantasy world map illustration of a land where old wooden villages, glass-and-steel modern towns and floating futuristic platforms coexist, rivers, bamboo valley, red canyon, misty marsh, ruined plateau, painted parchment map seen from above',
    'dungeon': 'dark fantasy world map illustration seen from above, central grassland surrounded by 8 different regions: ruined gray city, salt marsh flats, glowing hell rift, shining new city, desert sand road, heavenly shrine in clouds, snowy north mountains, rusty machine wasteland, painted parchment map',
    'forest': 'cozy storybook map illustration of a village surrounded by 8 themed forests: silver grass plain, glowing mushroom valley, blue pine forest, mossy boulder slope, dead tree twilight woods, flower petal hill, giant boulder pass, firefly oak forest, painted parchment map seen from above',
    'story': 'side-scrolling adventure world map illustration, a winding road connecting a starting town, a walled capital, meadow fields, a river port, a forest, a mountain fortress, caves, a fiery gorge, ancient ruins and three portals to past, present and future battlefields, painted parchment map',
    'realm': 'grand strategy game map illustration of a vast continent with plains, great rivers, northern snow mountains, western deserts, southern jungle, eastern islands and coastline, many regions bordered with faint lines, painted parchment map seen from above',
}


def batch():
    items = []
    n = 0
    for g, pr in MAP_PROMPT.items():
        for k in (1, 2, 3):
            n += 1
            items.append({'id': f'map_{g}_{k}', 'seed': 20271004 + 71 * n, 'prompt': pr})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'map',
         'defaults': {'prompt_prefix': 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, world map, top-down map view, painterly game map',
                      'width': 1056, 'height': 704, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a',
                      'negative': 'lowres, bad anatomy, text, letters, writing, labels, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, frame, border, compass, legend'},
         'items': items}
    p = os.path.join(HERE, 'batches', 'map.json')
    json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH map', len(items), '→', p)


def pack(picks_path=None):
    picks_path = picks_path or os.path.join(HERE, '_out', 'map_picks.json')
    picks = json.load(open(picks_path, encoding='utf-8')) if os.path.exists(picks_path) else {}
    src = os.path.join(HERE, '_out', 'map')
    for g in MAP_PROMPT:
        k = picks.get(g, 1)
        sp = os.path.join(src, f'map_{g}_{k}.png')
        im = Image.open(sp).convert('RGB').resize((1536, 1024), Image.LANCZOS)
        dst = os.path.join(OUT, f'map_{g}.webp')
        im.save(dst, 'WEBP', quality=82, method=6)
        lp = os.path.join(src, f'map_{g}_{k}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': f'map_{g}', 'game': g, 'picked_candidate': k, 'size': [1536, 1024], 'upscaled_from': [1056, 704], 'note': '글씨 없음 — 이름·좌표는 게임이 얹는다'})
        json.dump(lic, open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('지도', len(MAP_PROMPT))


def check():
    bad = []
    R = regions()
    n = 0
    for g, rows in R.items():
        for row in rows:
            p = os.path.join(OUT, 'icons', f'{g}_{row[0]}.png')
            n += 1
            if not os.path.exists(p):
                bad.append(f'없음 {g}_{row[0]}')
            elif Image.open(p).size != (64, 64):
                bad.append(f'크기 {g}_{row[0]}')
            elif not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
                bad.append(f'license 없음 {g}_{row[0]}')
    for g in MAP_PROMPT:
        p = os.path.join(OUT, f'map_{g}.webp')
        if not os.path.exists(p):
            bad.append(f'지도 없음 {g}')
        elif Image.open(p).size != (1536, 1024):
            bad.append(f'지도 크기 {g}')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _d, fs in os.walk(OUT) for f in fs if not f.endswith('.json')) / 1048576 if os.path.exists(OUT) else 0
    print(f'지역 아이콘 {n} · 지도 {len(MAP_PROMPT)} · {total:.2f}MB')
    print('MAP_FAIL' if bad else 'MAP_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'icons':
        icons()
    elif cmd == 'batch':
        batch()
    elif cmd == 'pack':
        pack(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
