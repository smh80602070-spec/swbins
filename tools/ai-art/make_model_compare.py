"""K-0013 — 같은 프롬프트·씨앗으로 모델 셋을 비교하는 배치 세 개를 쓴다.

py tools/ai-art/make_model_compare.py
→ batches/model_compare_<모델>.json (장당 id = cmp_<인물>, 출력 폴더 = model_compare_<모델>)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, 'batches', 'web_heroes_105.json'), encoding='utf-8'))
PICK = ['hero_eu_eleanor', 'hero_kr_heojun', 'hero_sg_zhugeliang', 'hero_jp_tomoegozen']   # 여·노인·남·젊은 여

# 모델마다 품질 태그만 다르다(프롬프트 본문·씨앗·네거티브는 같다)
MODELS = {
    'animagine-xl-4.0-opt': 'masterpiece, high score, great score, absurdres',
    'Illustrious-XL-v2.0': 'masterpiece, best quality, amazing quality, absurdres',
    'NoobAI-XL-v1.1': 'masterpiece, best quality, newest, absurdres, highres',
}
items = [i for i in SRC['items'] if i['id'] in PICK]
assert len(items) == len(PICK)

for model, prefix in MODELS.items():
    out = {
        'model': model,
        'out': 'model_compare_' + model.lower().replace('.', '_'),
        'defaults': dict(SRC['defaults'], prompt_prefix=prefix),
        'items': [dict(i, id='cmp_' + i['id'][5:]) for i in items],
    }
    path = os.path.join(HERE, 'batches', 'model_compare_' + model.lower().replace('.', '_') + '.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(path, len(out['items']))
