"""아이템 아이콘 시험 배치(K-0035 단계 3) — tools/ai-art/data/icon_trial30.json 의 30개를 gen.py 배치로 만든다.
  py tools/ai-art/make_icon_batch.py     # → tools/ai-art/batches/icons_trial30.json
프롬프트에는 원작·실존 이름을 쓰지 않는다(gen.py 의 BLOCK 이 막는다). 씨앗 = 아이디 해시(다시 돌려도 같음).
"""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, 'data', 'icon_trial30.json'), encoding='utf-8'))
TEMPLATE = '{tags}, no humans, still life, object focus, game icon, simple background, white background, centered, single object, hand-painted'
NEG = ('1girl, 1boy, solo, human, lowres, bad anatomy, text, error, signature, watermark, username, blurry, frame, border, multiple objects, hands, person, character, '
       'ground shadow, gradient background, background scenery, cropped, worst quality, low quality')
items = []
for it in spec['items']:
    seed = int(hashlib.md5(it['id'].encode()).hexdigest()[:8], 16)
    items.append({'id': it['id'], 'seed': seed, 'prompt': TEMPLATE.format(tags=it['tags']), 'negative': NEG})
batch = {'model': 'animagine-xl-4.0-opt', 'out': 'icons_trial30',
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5,
                      'sampler': 'Euler a', 'negative': NEG},
         'items': items}
out = os.path.join(HERE, 'batches', 'icons_trial30.json')
json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), '→', out)
