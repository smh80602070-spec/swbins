"""옷 무늬 타일 32종 → 배치(web_patterns_32.json). 이름·원작·작가 없이 천·무늬 묘사만.

  py tools/ai-art/make_pattern_batch.py
`tools/char-forge/make_wardrobe_textures.py` 가 이 타일을 옷 조각 질감의 패널 안에 입혀 옷 변형(아이템 외형)을 대량으로 만든다.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PATTERNS = {
    'floral_blue': 'blue and white floral cotton print, hibiscus flowers',
    'silk_red_gold': 'red silk fabric with gold embroidered cloud motifs',
    'leather_studs': 'black leather with small silver studs',
    'tartan_green': 'green and navy tartan plaid wool',
    'brocade_gold': 'gold brocade with ornate scroll pattern on deep blue',
    'batik_indigo': 'indigo batik fabric with white wax resist pattern',
    'linen_stripes': 'white linen with thin blue stripes',
    'velvet_purple': 'deep purple velvet with subtle gold trim pattern',
    'camo_green': 'green camouflage pattern fabric',
    'denim_worn': 'faded blue denim texture with stitching',
    'circuit_neon': 'dark fabric with glowing cyan circuit board lines',
    'holo_iridescent': 'iridescent holographic fabric in pink and teal',
    'carbon_weave': 'black carbon fiber weave with subtle highlights',
    'sakura_pink': 'pale pink fabric with cherry blossom petals pattern',
    'damask_crimson': 'crimson damask fabric with tonal floral pattern',
    'checker_bw': 'black and white checkered pattern cloth',
    'ethnic_geo': 'orange and yellow geometric woven pattern, folk textile',
    'scale_silver': 'silver metallic scale armor pattern',
    'waves_teal': 'teal fabric with concentric wave pattern',
    'leather_brown': 'worn brown leather with stitching lines',
    'sunflower': 'yellow sunflower print on green cloth',
    'starry_night': 'deep navy fabric with small gold stars',
    'herringbone_camel': 'camel colored wool herringbone tweed',
    'lace_white': 'white lace fabric with delicate floral openwork',
    'buffalo_plaid': 'red and black buffalo plaid flannel',
    'bamboo_green': 'emerald green silk with bamboo leaf pattern',
    'tweed_grey': 'grey tweed fabric with flecks',
    'cyber_gradient': 'magenta and cyan gradient fabric with thin grid lines',
    'canvas_beige': 'beige canvas fabric with visible weave',
    'heraldic_blue_gold': 'royal blue fabric with repeating gold emblem pattern',
    'coins_maroon': 'maroon fabric with repeating gold coin circles',
    'stripes_pastel': 'pastel rainbow stripes cotton fabric',
}
neg = ('lowres, text, watermark, signature, people, face, hands, blurry, 3d render, border, frame, perspective, folds, worst quality, low quality')
items = []
for k, v in PATTERNS.items():
    h = 2166136261
    for c in k.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    items.append({'id': 'pat_' + k, 'seed': h, 'prompt': f'no humans, flat lay, seamless tileable textile pattern, top-down close up, {v}, even lighting, high detail fabric texture', 'negative': neg})
b = {'model': 'animagine-xl-4.0-opt', 'out': 'web_patterns_32',
     'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.0, 'sampler': 'Euler a', 'negative': ''},
     'items': items}
json.dump(b, open(os.path.join(HERE, 'batches', 'web_patterns_32.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items))
