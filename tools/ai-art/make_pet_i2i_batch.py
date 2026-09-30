"""동물 펫 105 → 3D 대역 모델 렌더 밑그림 이미지→이미지 배치(web_pets_105_i2i.json).

  py tools/ai-art/make_pet_i2i_batch.py
밑그림 = `render_pets.py` 로 뽑은 종별 대역 모델 전신(`_out/pets_v3/<폴더>__<모델>.png`, 모델은 `saga-web/saga-go/js/asset3d.js` `pet:<id>` 표).
글(종·색·분위기)은 옛 배치(`web_pets_105.json`)의 것을 그대로 둔다. 저작자 표시가 필요한 모델(CC-BY: `standin/Elephant`)은 밑그림으로 쓰지 않는다(이 저장소는 CC0 전용 정책) —
그 펫은 옛 글만으로 만든 그림을 그대로 둔다(배치에서 빠진다).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'saga-web', 'saga-go')
CCBY = {'standin/Elephant.glb'}
s = open(os.path.join(WEB, 'js', 'asset3d.js'), encoding='utf-8').read()
model_of = dict(re.findall(r"'pet:([a-z_0-9]+)'\s*:\s*'([^']+)'", s))
b = json.load(open(os.path.join(HERE, 'batches', 'web_pets_105.json'), encoding='utf-8'))
items, skipped = [], []
for it in b['items']:
    m = model_of.get(it['id'])
    if not m or any(m.endswith(c) for c in CCBY):
        skipped.append(it['id'])
        continue
    parts = m.split('/')
    name = parts[-2] + '__' + os.path.splitext(parts[-1])[0]
    n = dict(it)
    n['init_image'] = os.path.join(HERE, '_out', 'pets_v3', name + '.png')
    n['meta'] = {'base_model': 'saga-web/saga-go/' + m, 'base_license': 'CC0-1.0 (Quaternius 계열 — saga-go ASSET_LICENSES 참조)'}
    if not os.path.exists(n['init_image']):
        raise SystemExit(f'밑그림 없음: {n["init_image"]}')
    items.append(n)
d = dict(b['defaults']); d['denoise'] = 0.62
out = {'model': b['model'], 'out': 'web_pets_105_i2i', 'defaults': d, 'items': items}
json.dump(out, open(os.path.join(HERE, 'batches', 'web_pets_105_i2i.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), 'skipped', skipped)
