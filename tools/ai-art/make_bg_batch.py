"""K-0015 단계 5 — 2D 모드 지역 배경 시험 배치 (Illustrious, 사람 없는 풍경, 과거·현대·미래가 한 자리에).

py tools/ai-art/make_bg_batch.py   →  batches/web_bg_test.json (지역 4 x 후보 2)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PREFIX = 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, wide shot, painterly game background'
NEG = ('lowres, bad anatomy, text, watermark, signature, username, blurry, worst quality, low quality, '
       '1girl, 1boy, solo, people, person, character, face, hands, close-up')
REGIONS = [
    ('east_fortress', 'ancient east asian fortress town at dawn, tiled roofs, stone walls, misty green mountains, floating paper lanterns, glowing holographic banners'),
    ('silk_oasis', 'desert silk road oasis, ruined sandstone temple, palm trees, caravan tents, futuristic glowing signal towers on dunes, warm golden light'),
    ('frost_plateau', 'frozen highland plateau, snow covered stone keep, ice blue crystal pylons, aurora in the sky, pine forest, cold mist'),
    ('harbor_dusk', 'harbor town at dusk, wooden sailing ships beside a tall space elevator, lanterns on piers, purple orange sunset sky, calm sea'),
]
items = []
for rid, desc in REGIONS:
    for k in (1, 2):
        items.append({'id': f'bg_{rid}_{k}', 'seed': 20261001 + 17 * k + len(rid), 'prompt': desc})
out = {'model': 'Illustrious-XL-v2.0', 'out': 'web_bg_test',
       'defaults': {'prompt_prefix': PREFIX, 'width': 1024, 'height': 576, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
       'items': items}
path = os.path.join(HERE, 'batches', 'web_bg_test.json')
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(path, len(items))
