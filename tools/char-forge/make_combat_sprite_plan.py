"""인물 299 무기별 8방향 2D 시트 계획표(K-0029 단계 5) — roster.json 의 인물마다 무기 한 종을 정해 bake_sprite_batch 계획을 쓴다.

  py tools/char-forge/make_combat_sprite_plan.py            # → data/combat_sprite_plan.json + data/hero_weapon.json
  py tools/char-forge/bake_sprite_batch.py tools/char-forge/data/combat_sprite_plan.json   # 굽기(이어하기, GPU 는 SD 와 겹치지 않게)

시트 형식(웹 W-0073 이 읽는다): <id>/<역할>.webp · 8프레임 · 행 5 = 방향 d0 정면 · d1 오른쪽 앞 3/4 · d2 오른쪽 옆 · d3 오른쪽 뒤 3/4 · d4 뒤
  (NDIR 8 — 왼쪽 셋 d5~d7 은 d3~d1 을 좌우로 뒤집어 쓴다, manifest `mirror: true`·`side_faces: right`).
역할 = idle·walk·attack·attack2·heavy·hit·death·knockdown — 무기와 무관한 이름, 무기는 그림에 들어 있다(manifest `weapon`·`clipmap`).
긴 무기(창·지팡이·도끼·활)는 칸만 192px·3.75m 로 키운다 — px/m 51.2 는 모두 같다(몸 크기 같음).
무기 고르기 = 기본값(게임이 hero_weapon.json 을 덮어쓰면 그걸로 다시 굽는다): 분명한 이모지 → 그 무기, 균열·폐허 시대 → 총, 나머지 → 특성별 후보 중 id 해시.
"""
import json
import os
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROSTER = os.path.join(HERE, 'data', 'roster.json')
PLAN = os.path.join(HERE, 'data', 'combat_sprite_plan.json')
MAP = os.path.join(HERE, 'data', 'hero_weapon.json')

EMOJI = {'🏹': 'bow', '🗡️': 'dagger', '⚔️': 'sword', '🪓': 'axe', '🛡️': 'sword', '🐎': 'spear', '🏇': 'spear', '🚩': 'spear', '🦅': 'bow',
         '🔮': 'staff', '📜': 'staff', '📖': 'staff', '🪶': 'staff', '🖋️': 'staff', '📗': 'staff', '🕯️': 'staff', '📿': 'staff', '🔔': 'staff',
         '🌙': 'staff', '🔥': 'staff', '⚡': 'staff', '❄️': 'staff', '💧': 'staff', '🌊': 'staff', '🐉': 'spear', '⛓️': 'fist', '💀': 'dagger',
         '⚓': 'sword', '⛵': 'sword', '🧭': 'sword', '🗺️': 'staff', '👑': 'sword', '🏯': 'sword'}
BY_TRAIT = {'might': ['axe', 'sword', 'spear', 'fist'], 'command': ['spear', 'sword', 'bow'], 'wisdom': ['staff', 'bow', 'dagger'],
            'virtue': ['sword', 'spear', 'staff']}
GUN_ERAS = ('균열(가상)', '폐허(가상)')
LONG = ('spear', 'staff', 'axe', 'bow')
TWO = {'spear': ['spear_idle', 'spear_1', 'spear_2', 'spear_heavy'], 'axe': ['axe_idle', 'axe_1', 'axe_2', 'axe_heavy'], 'staff': ['staff_heavy']}
CLIPMAP = {  # 역할 → _anims.glb 동작 이름(vroid_batch.sh CLIPS)
    'sword': {'idle': 'guard', 'attack': 'attack', 'attack2': 'sword_2', 'heavy': 'sword_heavy'},
    'spear': {'idle': 'spear_idle', 'attack': 'spear_1', 'attack2': 'spear_2', 'heavy': 'spear_heavy'},
    'axe': {'idle': 'axe_idle', 'attack': 'axe_1', 'attack2': 'axe_2', 'heavy': 'axe_heavy'},
    'dagger': {'idle': 'dagger_idle', 'attack': 'dagger_1', 'attack2': 'dagger_2', 'heavy': 'dagger_heavy'},
    'bow': {'idle': 'bow_idle', 'attack': 'bow_1', 'attack2': 'bow_1', 'heavy': 'bow_heavy'},
    'staff': {'idle': 'staff_idle', 'attack': 'skill', 'attack2': 'burst', 'heavy': 'staff_heavy'},
    'gun': {'idle': 'gun_idle', 'attack': 'gun_1', 'attack2': 'gun_1', 'heavy': 'gun_1'},
    'fist': {'idle': 'idle', 'attack': 'fist_1', 'attack2': 'fist_2', 'heavy': 'fist_heavy'},
}
COMMON = {'walk': 'walk', 'hit': 'hit', 'death': 'death', 'knockdown': 'knockdown'}
WEAPON_GLB = {'sword': 'sword', 'spear': 'spear', 'axe': 'axe', 'dagger': 'dagger', 'bow': 'bow', 'staff': 'staff', 'gun': 'gun', 'fist': 'gauntlet'}


def pick(h):
    e = (h.get('emoji') or '').strip()
    if e in EMOJI:
        return EMOJI[e], 'emoji'
    if h.get('era') in GUN_ERAS:
        return 'gun', 'era'
    c = BY_TRAIT.get(h.get('trait'), ['sword'])
    return c[zlib.crc32(h['id'].encode()) % len(c)], 'trait'


def grade(r):
    return 'legend' if (r or 3) >= 5 else 'rare' if r == 4 else 'common'


def main():
    heroes = json.load(open(ROSTER, encoding='utf-8'))['heroes']
    have = set(os.listdir(os.path.join(HERE, '_out', 'vroid')))
    ents, wmap = [], {}
    for h in heroes:
        if h['id'] not in have:
            continue
        w, why = pick(h)
        g = grade(h.get('rarity'))
        wmap[h['id']] = {'weapon': w, 'grade': g, 'why': why}
        e = {'id': h['id'], 'body': h['id'], 'kind': 'human', 'weapon_kind': w,
             'weapon': f'saga-assets/world/toon/wpn_{WEAPON_GLB[w]}_{g}.glb', 'clipmap': dict(CLIPMAP[w], **COMMON)}
        if w in TWO:
            e['two_hand_clips'] = TWO[w]
        if w in LONG:
            e.update(px=192, ortho=3.75, cam_z=1.15)
        ents.append(e)
    plan = {'note': 'K-0029 단계 5 — 인물 299 무기별 8방향 2D 시트(형식은 make_combat_sprite_plan.py 머리말). out 은 정본이 아니라 로컬 — 웹 W-0073 연결 뒤 정본(saga-assets/characters/sprites2d8)으로.',
            'px': 128, 'frames': 8, 'ortho': 2.5, 'cam_z': 0.95, 'ndir': 8, 'dirs': [0, 1, 2, 3, 4], 'out': 'tools/char-forge/_out/sprites8',
            'bodies': {e['id']: f'tools/char-forge/_out/vroid/{e["id"]}/{e["id"]}.glb' for e in ents}, 'entries': ents}
    json.dump(plan, open(PLAN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'note': '인물 → 2D 시트에 그린 무기(기본값, make_combat_sprite_plan.py). 게임이 바꾸면 이 표를 고쳐 그 인물만 다시 굽는다.', 'heroes': wmap},
              open(MAP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    from collections import Counter
    print('PLAN', len(ents), dict(Counter(v['weapon'] for v in wmap.values())), dict(Counter(v['why'] for v in wmap.values())))


if __name__ == '__main__':
    main()
