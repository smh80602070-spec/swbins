"""K-0056 단계 1 — 그림체 후보 시험. 1차(round 1): 후보 3 × 대상 4 = 12장 + hires 2장 → 그림체 B 가 낫다. 2차(round 2, 인자 2): B 계열 2모델 × 4 = 8장, 모두 hires 1.33.
  py tools/ai-art/make_style_trial.py [2]  → batches/style_trial.json | style_trial2.json
프롬프트 꼬리(STYLE)가 이후 전부의 상수가 된다. 원작·작가·실존 이름 금지(gen.py BLOCK).
"""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
NEG = ('lowres, bad anatomy, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, '
       'gradient background, background scenery, multiple views, border, frame')
SUBJ = {
    'building': ('wooden village house, tiled roof, small cottage, isometric view, no humans', ''),
    'tree': ('big leafy tree, green crown, brown trunk, isometric view, no humans', ''),
    'animal': ('red fox, standing, side view, full body, no humans', ''),
    'person': ('1boy, villager, plain tunic, standing, full body, front view', ''),
}
STYLES = {
    'A': ('animagine-xl-4.0-opt', 'game asset, cel shading, thick clean outline, saturated flat colors, hand-painted, sticker style, simple background, white background, centered, single object'),
    'B': ('animagine-xl-4.0-opt', 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single object'),
    'C': ('Illustrious-XL-v2.0', 'game asset, clean lineart, vibrant colors, soft cel shading, stylized fantasy, simple background, white background, centered, single object'),
}
ROUND2 = len(__import__('sys').argv) > 1 and __import__('sys').argv[1] == '2'
if ROUND2:
    NEG += ', base, platform, diorama, ground tile, floating island, scene, multiple objects, turntable, character sheet'
    SUBJ = {
        'building': ('single wooden village house, tiled roof, small cottage, three-quarter view from above, no humans, isolated object', ''),
        'tree': ('single big leafy tree, round green crown, brown trunk, visible roots, three-quarter view, no humans, isolated object', ''),
        'animal': ('red fox, standing, side view, full body, no humans', ''),
        'person': ('1boy, villager, plain tunic, standing, full body, front view, simple background', ''),
    }
    TAIL = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single object'
    STYLES = {'B': ('animagine-xl-4.0-opt', TAIL), 'D': ('Illustrious-XL-v2.0', TAIL)}
items = []
for sk, (model, tail) in STYLES.items():
    for k, (subj, _) in SUBJ.items():
        iid = f'{sk}_{k}'
        items.append({'id': iid, 'model': model, 'seed': int(hashlib.md5(iid.encode()).hexdigest()[:8], 16), 'prompt': f'{subj}, {tail}', 'negative': NEG})
if ROUND2:
    for it in items:
        it['hr'] = 1.33
else:
  for k in ('building', 'animal'):
    base = next(i for i in items if i['id'] == f'A_{k}')
    items.append({**base, 'id': f'A_{k}_hr', 'hr': 1.33})
OUTN = 'style_trial2' if ROUND2 else 'style_trial'
batch = {'model': 'animagine-xl-4.0-opt', 'out': OUTN,
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
         'items': items}
out = os.path.join(HERE, 'batches', OUTN + '.json')
json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), '→', out)
