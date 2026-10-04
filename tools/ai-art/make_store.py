"""K-0041 — 스토어·타이틀·로딩 일러스트 + 앱 아이콘: 판 5 × (키 아트 후보 4 → 고른 1장을 규격별로 / 로딩 3장).

  py tools/ai-art/make_store.py batch              # → batches/store_art.json (키 아트 20 = 판 5 × 후보 4, 로딩 15 = 판 5 × 3) — gen.py, Illustrious 1344×768
  py tools/ai-art/make_store.py sheet              # 고르기 시트 → _out/store_pick.jpg
  py tools/ai-art/make_store.py pack [picks]       # 규격별 포장 → _out/store/<판>/ (picks = _out/store_picks.json {"go":1,...}, 없으면 #1)
  py tools/ai-art/make_store.py check              # 규격 점검(크기·안전영역)·.license.json 100%

판마다 산출: key_h_1920x1080.webp(스토어 가로·타이틀) · key_v_1080x1920.webp(세로 스토어: 가운데 세로 자르기 + 위아래 번짐) · icon_1024.png(iOS, 알파 없음) · icon_512.png · icon_192.png(PWA)
            · android_fg_432.png(적응형 전경 — 안전 원 지름 288px 안에 핵심, 알파) · load_1~3_1920x1080.webp.
글자·로고는 그림에 넣지 않는다(게임이 얹는다). 사람 없이 풍경·상징 위주(얼굴 흐트러짐 위험 회피). 원작·작가 이름 금지(gen.py BLOCK).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'store')
GAMES = {
    'go': ('사가고', 'epic key art, a luminous portal gate standing in a mixed-era town square at golden hour, old timber houses beside glass towers, floating lanterns, a winding road leading to distant mountains, warm hopeful light'),
    'dungeon': ('사가블로', 'epic dark fantasy key art, a colossal ancient gate carved into a cliff glowing red, stone stairs descending into darkness, torches, floating embers, ruined arches, ominous cinematic light'),
    'forest': ('사가의숲', 'cozy storybook key art, a tiny cottage village glowing with warm lanterns among giant trees and fireflies at dusk, mushrooms, winding stream, magical gentle light'),
    'story': ('사가스토리', 'adventurous side-scrolling world key art, floating rock islands connected by rope bridges, waterfalls into clouds, a distant castle, a golden sunset sky with portals to different eras'),
    'realm': ('사가국지', 'grand strategy key art, a vast walled fortress city on a river plain at dawn, banners without markings, mist, mountains and ranks of tents in the distance, majestic sweeping composition'),
}
LOAD = {
    'go': ['quiet riverside village at sunrise with floating lanterns', 'misty bamboo valley with a glowing shrine', 'neon-lit future harbor beside old wooden ships at dusk'],
    'dungeon': ['torchlit stone corridor with iron doors', 'underground lava cavern with a stone bridge', 'ruined gothic hall with broken pillars and drifting embers'],
    'forest': ['sunny meadow village with a wooden bridge', 'glowing mushroom valley at night', 'autumn forest path with falling leaves and lanterns'],
    'story': ['floating islands at golden sunset', 'dark cave mouth with glowing crystals', 'ancient battlefield with torn banners under a stormy sky'],
    'realm': ['misty river and distant mountains at dawn', 'grand palace courtyard under a red sunset', 'endless plains with camp fires under a starry sky'],
}
PREFIX = 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, wide shot, painterly game key art, cinematic composition'
NEG = ('lowres, bad anatomy, text, letters, logo, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, '
       'frame, border')
GW, GH = 1344, 768


def batch():
    items = []
    n = 0
    for g, (_name, prompt) in GAMES.items():
        for k in range(1, 5):
            n += 1
            items.append({'id': f'store_{g}_key_{k}', 'seed': 20271004 + 83 * n, 'prompt': prompt})
        for k, pr in enumerate(LOAD[g], 1):
            n += 1
            items.append({'id': f'store_{g}_load_{k}', 'seed': 20271004 + 83 * n, 'prompt': pr + ', game loading screen scenery'})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'store',
         'defaults': {'prompt_prefix': PREFIX, 'width': GW, 'height': GH, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG}, 'items': items}
    p = os.path.join(HERE, 'batches', 'store_art.json')
    json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH store_art', len(items), '→', p)


def sheet():
    cw, ch = 336, 192
    rows = list(GAMES)
    out = Image.new('RGB', (cw * 7 + 12, (ch + 14) * len(rows)), (40, 40, 40))
    d = ImageDraw.Draw(out)
    for r, g in enumerate(rows):
        for c, name in enumerate([f'key_{k}' for k in range(1, 5)] + [f'load_{k}' for k in range(1, 4)]):
            p = os.path.join(OUT, 'store', f'store_{g}_{name}.png')
            x, y = c * (cw + 2), r * (ch + 14)
            if os.path.exists(p):
                out.paste(Image.open(p).convert('RGB').resize((cw, ch)), (x, y + 13))
            d.text((x + 3, y), f'{g} {name}', fill=(255, 255, 0))
    out.save(os.path.join(OUT, 'store_pick.jpg'), quality=84)
    print('시트', os.path.join(OUT, 'store_pick.jpg'))


def save(im, path, extra, fmt=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if path.endswith('.webp'):
        im.save(path, 'WEBP', quality=84, method=6)
    else:
        im.save(path, optimize=True)
    d = {'generator': 'tools/ai-art/make_store.py'}
    d.update(extra)
    d['id'] = os.path.splitext(os.path.basename(path))[0]
    d['size'] = list(im.size)
    json.dump(d, open(os.path.splitext(path)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def lic_of(src):
    lp = os.path.splitext(src)[0] + '.license.json'
    return json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}


def vertical(im):
    """가로 그림을 세로 1080×1920 로 — 가운데 세로 자르기를 본문으로, 위·아래는 같은 그림을 늘려 흐리게 깐다."""
    W, H = 1080, 1920
    bg = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(24))
    body = im.crop((int(im.width * 0.28), 0, int(im.width * 0.72), im.height))
    body = body.resize((W, int(W * body.height / body.width)), Image.LANCZOS)
    bg.paste(body, (0, (H - body.height) // 2))
    return bg


def pack(picks_path=None):
    picks_path = picks_path or os.path.join(OUT, 'store_picks.json')
    picks = json.load(open(picks_path, encoding='utf-8')) if os.path.exists(picks_path) else {}
    for g in GAMES:
        k = picks.get(g, 1)
        src = os.path.join(OUT, 'store', f'store_{g}_key_{k}.png')
        base = Image.open(src).convert('RGB')
        lic = lic_of(src)
        lic.update({'game': g, 'picked_candidate': k, 'upscaled_from': [GW, GH]})
        d = os.path.join(FINAL, g)
        h = base.resize((1920, 1080), Image.LANCZOS)
        save(h, os.path.join(d, 'key_h_1920x1080.webp'), lic)
        save(vertical(h), os.path.join(d, 'key_v_1080x1920.webp'), lic)
        s = min(base.size)
        sq = base.crop(((base.width - s) // 2, 0, (base.width - s) // 2 + s, s))
        sq1024 = sq.resize((1024, 1024), Image.LANCZOS)
        save(sq1024, os.path.join(d, 'icon_1024.png'), lic)
        save(sq1024.resize((512, 512), Image.LANCZOS), os.path.join(d, 'icon_512.png'), lic)
        save(sq1024.resize((192, 192), Image.LANCZOS), os.path.join(d, 'icon_192.png'), lic)
        fg = Image.new('RGBA', (432, 432), (0, 0, 0, 0))                            # 적응형 전경: 안전 원 지름 288 안에 핵심
        core = sq.resize((288, 288), Image.LANCZOS).convert('RGBA')
        mask = Image.new('L', (288, 288), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 287, 287), fill=255)
        core.putalpha(mask)
        fg.paste(core, (72, 72), core)
        save(fg, os.path.join(d, 'android_fg_432.png'), lic)
        for i in (1, 2, 3):
            ls = os.path.join(OUT, 'store', f'store_{g}_load_{i}.png')
            save(Image.open(ls).convert('RGB').resize((1920, 1080), Image.LANCZOS), os.path.join(d, f'load_{i}_1920x1080.webp'), {**lic_of(ls), 'game': g})
    print('스토어 포장', len(GAMES))


def check():
    bad = []
    total = 0
    spec = {'key_h_1920x1080.webp': (1920, 1080), 'key_v_1080x1920.webp': (1080, 1920), 'icon_1024.png': (1024, 1024), 'icon_512.png': (512, 512), 'icon_192.png': (192, 192),
            'android_fg_432.png': (432, 432), 'load_1_1920x1080.webp': (1920, 1080), 'load_2_1920x1080.webp': (1920, 1080), 'load_3_1920x1080.webp': (1920, 1080)}
    for g in GAMES:
        for n, sz in spec.items():
            p = os.path.join(FINAL, g, n)
            if not os.path.exists(p):
                bad.append(f'없음 {g}/{n}')
                continue
            total += os.path.getsize(p)
            if Image.open(p).size != sz:
                bad.append(f'크기 {g}/{n}')
            if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
                bad.append(f'license 없음 {g}/{n}')
        p = os.path.join(FINAL, g, 'icon_1024.png')
        if os.path.exists(p) and Image.open(p).mode in ('RGBA', 'LA'):
            bad.append(f'{g} iOS 아이콘에 알파가 있다')
        fgp = os.path.join(FINAL, g, 'android_fg_432.png')
        if os.path.exists(fgp):
            a = Image.open(fgp).getchannel('A')
            bb = a.point(lambda v: 255 if v > 8 else 0).getbbox()
            if bb and (bb[0] < 72 or bb[1] < 72 or bb[2] > 360 or bb[3] > 360):
                bad.append(f'{g} 적응형 전경이 안전영역을 벗어남')
    mb = total / 1048576
    print(f'스토어 {len(GAMES)}판 · 파일 {len(GAMES) * len(spec)} · 합계 {mb:.1f}MB')
    print('STORE_FAIL' if bad else 'STORE_OK')
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'batch':
        batch()
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'pack':
        pack(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
