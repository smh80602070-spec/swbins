"""K-0160 ④ 도감 60 계획 생성(1회) — 도감(codex) 명단 순서, 옷 이식 몸(_out/vroid/<id>) + _anims 있는 첫 60."""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
os.chdir(ROOT)
base = json.load(open('tools/char-forge/recipes/factory/k158_still_people.json', encoding='utf-8'))
roster = json.load(open('tools/char-forge/data/roster.json', encoding='utf-8'))['heroes']
hw = json.load(open('tools/char-forge/data/hero_weapon.json', encoding='utf-8'))['heroes']
CLIPMAP = {
    'sword': {'idle': 'guard', 'attack': 'attack', 'attack2': 'sword_2'},
    'spear': {'idle': 'spear_idle', 'attack': 'spear_1', 'attack2': 'spear_2'},
    'axe': {'idle': 'axe_idle', 'attack': 'axe_1', 'attack2': 'axe_2'},
    'dagger': {'idle': 'dagger_idle', 'attack': 'dagger_1', 'attack2': 'dagger_2'},
    'bow': {'idle': 'bow_idle', 'attack': 'bow_1', 'attack2': 'bow_heavy'},
    'staff': {'idle': 'idle', 'attack': 'skill', 'attack2': 'burst'},
    'gun': {'idle': 'gun_idle', 'attack': 'gun_1', 'attack2': 'gun_1'},
    'fist': {'idle': 'idle', 'attack': 'fist_1', 'attack2': 'fist_heavy'},
}
PX = {'sword': 256, 'dagger': 256, 'axe': 320, 'bow': 256, 'gun': 256, 'staff': 320, 'spear': 384, 'fist': 192}
# 10-22 판정 crop(무기·팔이 칸 끝에 닿음) 19풀만 한 단계 큰 칸(px/m 같음 — 그림 크기 그대로, 칸만 넓힘)
PX_UP = {'spear': 448, 'bow': 320, 'staff': 384, 'fist': 224}
CROP = ["jp_ieyasu", "jp_kenshin", "kr_choemuseon", "kr_euljimundeok", "kr_ganggamchan", "kr_gwanggaeto", "kr_heojun", "kr_kimgu", "kr_nongae", "kr_sejong", "kr_sinsaimdang", "sg_diaochan", "sg_lubu", "sg_machao", "sg_simayi", "sg_sunquan", "sg_zhangfei", "sg_zhaoyun", "sg_zhouyu"]
TWO = {'spear': ['spear_idle', 'spear_1', 'spear_2', 'spear_heavy'], 'axe': ['axe_idle', 'axe_1', 'axe_2', 'axe_heavy'], 'staff': ['staff_heavy']}
pools, bodies = [], {}
for h in roster:
    if h['src'] != 'codex':
        continue
    i = h['id']
    g = f'tools/char-forge/_out/vroid/{i}/{i}.glb'
    if not (os.path.exists(g) and os.path.exists(g[:-4] + '_anims.glb')):
        continue
    w = hw.get(i, {}).get('weapon', 'fist')
    grade = hw.get(i, {}).get('grade', 'common')
    p = {'id': i, 'type': 'human', 'body': i, 'kind': 'human', 'act': dict(CLIPMAP[w]), 'px': PX_UP[w] if i in CROP else PX[w]}
    lj = f'saga-web/shared/assets/characters2d8/{i}/{i}.license.json'
    if os.path.exists(lj):
        p['source_license'] = lj
    if w != 'fist':
        wg = f'saga-assets/world/toon/wpn_{w}_{grade}.glb'
        p.update(weapon=wg if os.path.exists(wg) else f'saga-assets/world/toon/wpn_{w}_common.glb', weapon_kind=w)
        if w in TWO:
            p['two_hand_clips'] = TWO[w]
        if w in ('sword', 'dagger', 'axe', 'spear'):
            p['center_roles'] = ['attack', 'attack2']
        if w == 'staff':
            p['combat_roles'] = ['attack', 'attack2']
    pools.append(p)
    bodies[i] = g
    if len(pools) == 60:
        break
plan = {k: base[k] for k in ('px', 'ndir', 'dirs', 'dir_names', 'ortho', 'cam_z', 'foot', 'style', 'style_ref', 'clips', 'canon')}
plan['clips'] = json.loads(json.dumps(plan['clips']))
for r_ in ('attack', 'attack2'):      # 10-22 눈: 칼·창 치켜든 한 칸(넓이 튐 0.35~0.40)이 정상 휘두르기 — 판정기 spiky
    plan['clips'][r_]['spiky'] = True
plan.update(note='K-0160 ④ 도감 인물 60 — 도감(roster src=codex) 순서로 옷 이식 몸(K-0024 _out/vroid/<id>, 몸 _anims) 이 있는 첫 60. 무기 = data/hero_weapon.json(make_combat_sprite_plan CLIPMAP·무기 등급 glb), 칸 = K-0159 처럼 무기 길이로(px/m 같음). 옷·머리는 몸 그대로(kind human). 생성: tools/char-forge/recipes/factory/gen_dex60.py(1회)',
            ticket='K-0160', game='saga-dungeon',
            human=dict(base['human'], bodies=bodies, kinds={}),
            pools=pools,
            deploy={'saga-web/shared/assets/sprites2d_sheets': None})   # 10-22 다섯 판 복사 = 60×1.7MB×5 ≈ 500MB → shared 한 벌(W-0359 방향), 판 배선은 웹 수신함
plan['human'].pop('kinds')
json.dump(plan, open('tools/char-forge/recipes/factory/k159_dex60.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(pools), Counter(p.get('weapon_kind', 'fist') for p in pools), Counter(p['px'] for p in pools))
