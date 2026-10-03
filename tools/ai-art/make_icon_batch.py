"""아이템 아이콘 배치(K-0035 단계 3) — 계획표의 그림 키를 gen.py 배치로 만든다.
  py tools/ai-art/make_icon_batch.py            # data/icon_plan.json(build_icon_plan.py 결과) → batches/icons_all.json (시험 30 에서 같은 프롬프트로 이미 만든 그림은 복사)
  py tools/ai-art/make_icon_batch.py trial30    # data/icon_trial30.json → batches/icons_trial30.json
프롬프트에는 원작·실존 이름을 쓰지 않는다(gen.py 의 BLOCK 이 막는다). 씨앗 = 아이디 해시(다시 돌려도 같음).
"""
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = sys.argv[1] if len(sys.argv) > 1 else 'plan'
SPEC = {'plan': ('icon_plan.json', 'icons_all'), 'trial30': ('icon_trial30.json', 'icons_trial30')}[NAME]
spec = json.load(open(os.path.join(HERE, 'data', SPEC[0]), encoding='utf-8'))
TEMPLATE = '{tags}, no humans, still life, object focus, game icon, simple background, white background, centered, single object, hand-painted'
NEG = ('1girl, 1boy, solo, human, lowres, bad anatomy, text, error, signature, watermark, username, blurry, frame, border, multiple objects, hands, person, character, '
       'ground shadow, gradient background, background scenery, cropped, worst quality, low quality')
items = []
for it in spec['items']:
    salt = it.get('salt', 0)   # 재뽑기: 소금을 올리면 다른 씨앗(1 이상은 상자·틀 부정어도 더한다)
    seed = int(hashlib.md5((it['id'] + ('#%d' % salt if salt else '')).encode()).hexdigest()[:8], 16)
    items.append({'id': it['id'], 'seed': seed, 'prompt': TEMPLATE.format(tags=it['tags']), 'negative': NEG + (', box, gift box, case, package, frame, picture frame, border, cube' if salt else '')})
batch = {'model': 'animagine-xl-4.0-opt', 'out': SPEC[1],
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5,
                      'sampler': 'Euler a', 'negative': NEG},
         'items': items}
out = os.path.join(HERE, 'batches', SPEC[1] + '.json')
json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), '→', out)

if NAME == 'plan':   # 시험 30 의 그림 중 프롬프트가 그대로인 것은 복사(씨앗·프롬프트가 같아 다시 그려도 같은 그림)
    old = os.path.join(HERE, '_out', 'icons_trial30')
    new = os.path.join(HERE, '_out', SPEC[1])
    os.makedirs(new, exist_ok=True)
    old_batch = os.path.join(HERE, 'batches', 'icons_trial30.json')
    same = 0
    if os.path.exists(old_batch):
        prev = {i['id']: i['prompt'] for i in json.load(open(old_batch, encoding='utf-8'))['items']}
        for it in items:
            src = os.path.join(old, it['id'] + '.png')
            if prev.get(it['id']) == it['prompt'] and os.path.exists(src) and not os.path.exists(os.path.join(new, it['id'] + '.png')):
                for ext in ('.png', '.license.json'):
                    shutil.copy(os.path.join(old, it['id'] + ext), os.path.join(new, it['id'] + ext))
                same += 1
    print('시험 30 에서 복사 %d장' % same)
