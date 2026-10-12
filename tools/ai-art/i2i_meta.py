"""이미지→이미지 그림의 출처 칸 — 밑그림(공방 몸 렌더)과 그 몸의 입력 라이선스를 `.license.json` 에 남긴다."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
HEROES = [('hero', os.path.join(HERE, '..', 'char-forge', '_out', 'hero')), ('realm', os.path.join(HERE, '..', 'char-forge', '_out', 'realm')),
          ('toon', os.path.join(HERE, '..', '..', 'saga-assets', 'world', 'toon'))]     # 몬스터·보스 몸(K-0043) — K-0088
REL = {'hero': 'tools/char-forge/_out/hero', 'realm': 'tools/char-forge/_out/realm', 'toon': 'saga-assets/world/toon'}


def base_meta(init_image, denoise):
    lp = os.path.splitext(os.path.join(HERE, '..', '..', init_image))[0] + '.license.json'
    if os.path.exists(lp):        # 밑그림이 몸 렌더가 아니라 AI 그림(K-0047 표정 ← 도감 초상) — 그 그림의 출처를 물려받는다
        b = json.load(open(lp, encoding='utf-8'))
        m = {'mode': 'img2img', 'init_image': init_image.replace('\\', '/'), 'denoise': float(denoise),
             'init_model': b.get('model', ''), 'init_model_license': b.get('model_license', '')}
        m.update({k: b[k] for k in ('base_body', 'base_license', 'base_inputs') if k in b})
        return m
    name = os.path.splitext(os.path.basename(init_image))[0]      # busts/hero_<id>.png -> hero_<id>
    sub, d = next(((s, h) for s, h in HEROES if os.path.exists(os.path.join(h, name + '.glb'))), HEROES[0])
    m = {'mode': 'img2img', 'init_image': f'tools/ai-art/_out/busts{"_realm" if sub == "realm" else ""}/{name}.png', 'denoise': float(denoise),
         'base_body': f'{REL[sub]}/{name}.glb'}
    p = os.path.join(d, name + '.license.json')
    if os.path.exists(p):
        b = json.load(open(p, encoding='utf-8'))
        m['base_license'] = b.get('license', '')
        m['base_inputs'] = b.get('inputs', [])
    else:
        m['base_license'] = '(공방 몸 license.json 없음 — 확인 필요)'
    return m
