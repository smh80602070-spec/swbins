"""K-0015 — 위에서 내려다보는 지도용 바닥 타일 시험 배치 (Illustrious, 이음매는 make_seamless.py 가 만든다).

py tools/ai-art/make_tile_batch.py  →  batches/web_tiles_test.json (바닥 8종)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PREFIX = 'seamless tileable ground texture swatch, flat orthographic material, hand painted game texture, even lighting, no objects'
NEG = ('person, people, human, body, skin, hands, feet, face, nude, naked, character, anime, girl, boy, animal, text, watermark, signature, border, frame, '
       'vignette, perspective, horizon, sky, shadow, building, large rock, tree, single object, flower, high contrast spots, blurry, lowres, worst quality')
TILES = [
    ('grass', 'lush green grass ground, small clover leaves, even lighting'),
    ('dirt_road', 'packed brown dirt ground texture with small pebbles and fine cracks'),
    ('cobble', 'old grey cobblestone pavement, mossy gaps between stones'),
    ('sand', 'warm desert sand ground with soft wind ripples'),
    ('snow', 'soft powdery white snow surface texture, faint pale blue tint, tiny sparkles'),
    ('ice', 'frozen ice floor with fine cracks, pale blue'),
    ('lava_rock', 'dark volcanic rock ground with thin glowing orange cracks'),
    ('shallow_water', 'calm turquoise water surface texture, soft ripples and light caustics, seen from above'),
]
items = [{'id': f'tile_{k}', 'seed': 20261002 + 31 * i + (7 if k in ('dirt_road', 'snow', 'shallow_water') else 0), 'prompt': desc} for i, (k, desc) in enumerate(TILES)]
out = {'model': 'sd_xl_base_1.0', 'out': 'web_tiles_test',
       'defaults': {'prompt_prefix': PREFIX, 'width': 640, 'height': 640, 'steps': 30, 'cfg': 6.5, 'sampler': 'Euler a', 'negative': NEG},
       'items': items}
path = os.path.join(HERE, 'batches', 'web_tiles_test.json')
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(path, len(items))
