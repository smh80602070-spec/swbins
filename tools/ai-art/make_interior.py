"""K-0025 — 건물 실내 배경(2D): 건물 12종 × 방(13) × 후보 2 → 고르기 → 방 그림 1536×768 + 앞가림 층(투명 WebP).

  py tools/ai-art/make_interior.py batch              계획표 → batches/web2d_interior.json (gen.py 로 생성, Illustrious-XL-v2.0)
  py tools/ai-art/make_interior.py sheet              고르기 시트 → _out/interior_pick.jpg (방마다 #1|#2)
  py tools/ai-art/make_interior.py pack [picks.json]  고른 후보 → _out/interior_final/<방>.webp + <방>_front.webp + .license.json  (기본 picks = _out/interior_picks.json, 없으면 전부 #1)
  py tools/ai-art/make_interior.py check              개수·크기·용량(≤6MB)·.license.json 100%

방 = 건물 id + 용도. 시대 혼합: 방마다 다른 시대의 작은 소품 한 점. 사람·얼굴 없음, 원작·작가·실존 이름 금지(gen.py BLOCK).
앞가림 층 = 방 그림 아래쪽 20% 를 위쪽이 번지게 잘라 살짝 어둡게 한 것(캐릭터 발 앞에 그린다).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'interior_final')
W, H = 1536, 768
GEN_W, GEN_H = 1216, 608                                                     # 생성 크기(가로 2:1) — 1536×768 로 키운다
PREFIX = 'masterpiece, best quality, amazing quality, absurdres, interior scenery, no humans, wide shot, painterly game background, room interior, side view'
NEG = ('lowres, bad anatomy, text, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, '
       'close-up, outdoors, exterior')

# 방 id = <건물 id 앞부분>_<용도>. 소품 한 점은 다른 시대(과거 방엔 미래 소품, 현대·미래 방엔 옛 소품).
ROOMS = [
    ('eu_house_hearth', 'eu_house_01', 'cozy timber house living room, stone fireplace with embers, wooden beams, woven rug, bookshelf, a small glowing hover lamp floating over the table, warm candlelight'),
    ('modern_block_flat', 'modern_block_01', 'modern apartment living room, large window with city skyline, sofa, bookshelves, plants, an old bronze sword hung on the wall, soft evening light'),
    ('future_dome_lounge', 'future_dome_01', 'futuristic dome house lounge, curved white walls, ring windows showing stars, floating holographic table, a wooden spinning wheel in the corner, cool blue light'),
    ('stone_tower_chamber', 'stone_tower_01', 'upper chamber of a stone watchtower, arrow slit windows, spiral stair, wooden desk with maps, a small glowing hologram globe, torch light'),
    ('chinese_hall_throne', 'chinese_hall_01', 'grand wooden palace hall interior, red lacquered pillars, carved ceiling, silk banners without markings, low platform, a tiny drone lantern floating near the roof, golden light'),
    ('dungeon_gate_antechamber', 'dungeon_gate_01', 'dungeon antechamber, rough stone walls, iron torches, cracked floor, rusted chains, a glowing sci-fi terminal embedded in the wall, dim light'),
    ('forest_cottage_room', 'forest_cottage_01', 'small thatched cottage room, round window, wooden table, clay pots, hanging herbs, bed with patchwork quilt, a tiny glowing solar lantern on the shelf, soft daylight'),
    ('inn_hall', 'inn_01', 'busy village inn common hall, long wooden tables, barrels, hanging lanterns, big hearth, a neon drink sign on the wall, warm light'),
    ('inn_guestroom', 'inn_01', 'inn guest room, two wooden beds, small desk, window with curtains, candle, a charging pad glowing on the nightstand, quiet evening'),
    ('barn_hayloft', 'barn_01', 'large red barn interior, hay bales stacked, wooden beams, farm tools on the wall, light shafts through planks, a small robot milking arm in a stall corner'),
    ('hanok_sarangbang', 'hanok_01', 'traditional korean room, paper sliding doors, wooden floor, low desk, folded blankets, ceramic jars, a glowing holographic scroll hovering above the desk, soft daylight'),
    ('jp_minka_irori', 'jp_minka_01', 'traditional farmhouse room with sunken hearth, thatched ceiling beams, tatami mats, hanging pot, a small floating drone lantern, warm firelight'),
    ('silkroad_house_room', 'silkroad_house_01', 'desert clay-brick house interior, arched doorways, woven carpets, cushions, brass lamps, a small floating crystal lamp, warm sandy light'),
]


def batch():
    items = []
    n = 0
    for rid, bid, prompt in ROOMS:
        for k in (1, 2):
            n += 1
            items.append({'id': f'int_{rid}_{k}', 'seed': 20271004 + 41 * n, 'prompt': prompt})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'web2d_interior',
         'defaults': {'prompt_prefix': PREFIX, 'width': GEN_W, 'height': GEN_H, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
         'items': items}
    p = os.path.join(HERE, 'batches', 'web2d_interior.json')
    json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH web2d_interior', len(items), '→', p)


def sheet():
    cw, ch = 560, 280
    out = Image.new('RGB', (cw * 2 + 6, (ch + 16) * len(ROOMS)), (40, 40, 40))
    d = ImageDraw.Draw(out)
    for r, (rid, _b, _p) in enumerate(ROOMS):
        for k in (1, 2):
            p = os.path.join(OUT, 'web2d_interior', f'int_{rid}_{k}.png')
            if os.path.exists(p):
                out.paste(Image.open(p).convert('RGB').resize((cw, ch)), ((k - 1) * (cw + 6), r * (ch + 16) + 14))
            d.text(((k - 1) * (cw + 6) + 4, r * (ch + 16) + 1), f'{rid} #{k}', fill=(255, 255, 0))
    p = os.path.join(OUT, 'interior_pick.jpg')
    out.save(p, quality=84)
    print('시트', p)


def front_layer(img):
    """앞가림 층 — 아래 20%, 위쪽 가장자리가 투명하게 번지고 살짝 어둡다."""
    h = int(H * 0.2)
    crop = img.crop((0, H - h, W, H)).convert('RGBA')
    px = crop.load()
    for y in range(h):
        a = min(1.0, y / (h * 0.55))
        for x in range(W):
            r, g, b, _ = px[x, y]
            px[x, y] = (int(r * 0.82), int(g * 0.82), int(b * 0.82), int(255 * a))
    return crop


def pack(picks_path=None):
    picks_path = picks_path or os.path.join(OUT, 'interior_picks.json')
    picks = json.load(open(picks_path, encoding='utf-8')) if os.path.exists(picks_path) else {}
    os.makedirs(FINAL, exist_ok=True)
    n = 0
    for rid, bid, prompt in ROOMS:
        k = picks.get(rid, 1)
        src = os.path.join(OUT, 'web2d_interior', f'int_{rid}_{k}.png')
        im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
        room = os.path.join(FINAL, f'{rid}.webp')
        front = os.path.join(FINAL, f'{rid}_front.webp')
        im.save(room, 'WEBP', quality=80, method=6)
        front_layer(im).save(front, 'WEBP', quality=82, method=6)
        lp = os.path.join(OUT, 'web2d_interior', f'int_{rid}_{k}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        for name, layer in ((rid, 'room'), (rid + '_front', 'front')):
            d = dict(lic)
            d.update({'id': name, 'building': bid, 'layer': layer, 'picked_candidate': k, 'size': [W, H] if layer == 'room' else [W, int(H * 0.2)],
                      'derived': 'tools/ai-art/make_interior.py pack', 'upscaled_from': [GEN_W, GEN_H]})
            json.dump(d, open(os.path.join(FINAL, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n += 2
    print('PACK interior', n)


def check():
    bad = []
    total = 0
    for rid, bid, _p in ROOMS:
        for name, size in ((rid, (W, H)), (rid + '_front', (W, int(H * 0.2)))):
            p = os.path.join(FINAL, name + '.webp')
            if not os.path.exists(p):
                bad.append('없음 ' + name)
                continue
            total += os.path.getsize(p)
            if not os.path.exists(os.path.join(FINAL, name + '.license.json')):
                bad.append('license 없음 ' + name)
            if Image.open(p).size != size:
                bad.append(f'크기 {name} {Image.open(p).size}')
    mb = total / 1048576
    print(f'방 {len(ROOMS)} · 파일 {len(ROOMS) * 2} · 합계 {mb:.2f}MB (≤6MB)')
    if mb > 6:
        bad.append('용량 6MB 초과')
    print('INTERIOR_FAIL' if bad else 'INTERIOR_OK')
    for b in bad:
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
