"""K-0113 — 옛 world-forge 몸(Poly Haven 재질) 렌더를 밑그림으로 그린 AI 그림 49장을 새 몸 렌더로 다시 그린다.
정본 license 에 적힌 프롬프트·부정어·씨앗·걸음·cfg·denoise 를 그대로, 밑그림만 새 렌더로 → batches/k113_regen.json (출력 _out/k113_regen/<id>.png).

  py tools/ai-art/make_k113_regen.py        # 배치를 쓴다 → py tools/ai-art/gen.py tools/ai-art/batches/k113_regen.json
밑그림: 몬스터 _out/monster_init(make_monster_dex.py render) · 탈것 _out/mount_init(용 = pets3d/pet_pt_cheongryong) ·
RTS 건물 _out/rts_bld_init_k113 · 도시 _out/k83_init_k113 (world-forge build_rts → _render_dir.sh SIZE=512 EL=40 → 768 흰 바탕, 가로 640, +20).
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out')
GROUPS = [
    ('portraits-monster', 'saga-assets/portraits-monster/*.license.json', lambda i: os.path.join(OUT, 'monster_init', i + '.png')),
    ('portraits-mount', 'saga-assets/portraits-mount/mt_dragon.license.json', lambda i: os.path.join(OUT, 'mount_init', i + '.png')),
    ('web2d-rts', 'saga-assets/web2d/rts/rts_*.license.json', lambda i: os.path.join(OUT, 'rts_bld_init_k113', i + '.png')),
    ('world-sprite-city', 'saga-assets/world/sprite/city_*.license.json', lambda i: os.path.join(OUT, 'k83_init_k113', 'rts_' + i + '.png')),
]
items = []
for group, pat, init in GROUPS:
    for lp in sorted(glob.glob(os.path.join(ROOT, pat))):
        lic = json.load(open(lp, encoding='utf-8'))
        if lic.get('mode') != 'img2img':
            continue
        txt = json.dumps(lic, ensure_ascii=False)
        if 'Poly Haven' not in txt and 'build_rts' not in txt and 'rts_city' not in txt:
            continue
        pid = lic['id']
        ip = init(pid)
        if not os.path.exists(ip):
            raise SystemExit(f'밑그림 없음 {ip}')
        items.append({'id': pid, 'seed': int(lic['seed']), 'prompt': lic['prompt'], 'negative': lic.get('negative_prompt', ''),
                      'steps': int(lic.get('steps', 28)), 'cfg': float(lic.get('cfg_scale', 5.5)), 'init_image': ip, 'denoise': float(lic['denoise']),
                      'meta': {'mode': 'img2img', 'denoise': float(lic['denoise']), 'k113_group': group,
                               'init_image': os.path.relpath(ip, ROOT).replace(os.sep, '/') + ' (K-0113 자체 PBR 몸 렌더)',
                               'base_license': 'CC0-1.0 (world-forge 형태 코드 + 자체 PBR 재질 K-0093·K-0113, 남의 사진 0)',
                               'redo_of': os.path.relpath(lp, ROOT).replace(os.sep, '/')}})
json.dump({'model': 'animagine-xl-4.0-opt', 'out': 'k113_regen',
           'note': 'K-0113 — 옛 밑그림(Poly Haven 재질 몸)으로 그린 AI 그림을 같은 씨앗·프롬프트로 새 밑그림에서 다시',
           'defaults': {'prompt_prefix': '', 'width': 768, 'height': 768, 'sampler': 'Euler a', 'variants': 4},
           'items': items}, open(os.path.join(HERE, 'batches', 'k113_regen.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
from collections import Counter
print('K113_REGEN', len(items), dict(Counter(i['meta']['k113_group'] for i in items)))
