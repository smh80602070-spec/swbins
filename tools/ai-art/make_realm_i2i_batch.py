"""사가천하 장수 194 → 공방 몸 밑그림 이미지→이미지 배치(web_realm_194_i2i.json).

  py tools/ai-art/make_realm_i2i_batch.py
글만으로 만든 옛 배치(web_realm_194.json)의 문화·역할 묘사는 두고, 머리색·눈색·나이만 **레시피(=몸)** 에서 다시 읽어 바꾼다 —
몸 렌더(_out/busts_realm/hero_<id>.png, render_busts.py)와 글이 어긋나지 않게. 성별은 옛 배치와 몸이 같다(gen_realm_recipes.py 가 옛 배치 글에서 읽는다).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FORGE = os.path.join(HERE, '..', 'char-forge')
sys.path.insert(0, HERE)
from make_hero_batch import hair_name, age_txt, EYE  # noqa: E402

b = json.load(open(os.path.join(HERE, 'batches', 'web_realm_194.json'), encoding='utf-8'))
items = []
for it in b['items']:
    r = json.load(open(os.path.join(FORGE, 'recipes', 'realm', 'hero_' + it['id'] + '.json'), encoding='utf-8'))
    female = r['macro']['gender'] < 0.5
    hair = hair_name(r.get('tints', {}).get('hair'), female, 'xx')
    eyes = EYE.get(r.get('eye_color', 'brown'), 'brown eyes')
    parts = [p.strip() for p in it['prompt'].split(',')]
    parts = [p for p in parts if not re.fullmatch(r'[a-z ]+ hair', p) and not re.fullmatch(r'[a-z ]+ eyes', p)]
    k = parts.index('upper body portrait') + 1
    parts[k:k] = [age_txt(r['macro']['age'], female), hair, eyes]
    n = dict(it)
    n['prompt'] = ', '.join(parts)
    n['init_image'] = os.path.join(HERE, '_out', 'busts_realm', 'hero_' + it['id'] + '.png')
    items.append(n)
d = dict(b['defaults']); d['denoise'] = 0.55
out = {'model': b['model'], 'out': 'web_realm_194_i2i', 'defaults': d, 'items': items}
json.dump(out, open(os.path.join(HERE, 'batches', 'web_realm_194_i2i.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), items[0]['prompt'][:260])
