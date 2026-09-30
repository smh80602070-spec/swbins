"""char-forge 의상 시스템 2단계 — 체형 칸(archetype)별 마네킹 × 옷 틀 레시피(recipes/costume/cos_<칸>_<지역>_<옷>.json).

    py tools/char-forge/gen_costume_recipes.py            # 레시피를 쓴다
    py tools/char-forge/gen_costume_recipes.py --garments # 지을 공방 옷 인자(garments.py -- all $(…))

설계 = COSTUME-SYSTEM.md §3. 한 칸의 몸은 체격·키·나이가 고정이라(마네킹) 같은 칸 어떤 캐릭터에도 조각이 어긋나지 않는다.
각 레시피는 (칸, 옷 갈래 reg, 옷 틀) 하나 = `export_parts.py` 로 쪼갤 몸 한 벌(맨몸 + 겉옷 조각 + 신발·머리 조각).
옷 색은 세력 색이 아니라 중립 색 한 벌로 지어 두고, 게임이 재질 `tint` 로 바꾼다(아이템 색 변형 = 재빌드 없음).
칸 = 남 보통·근육·육중, 여 보통·마름. 갈래 = 동양(sg: 삼국풍 동양 옷) · 서양(eu). 한국·일본풍은 세력 색이 아니라 옷 틀이 달라(hanbok·kimono …) reg kr·jp 도 쓴다.
"""
import json
import os
import sys

import gen_hero_recipes as G

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'recipes', 'costume')

# 칸 → (여자?, 체격 칸 0..3, 키 칸 0..4, 나이)
ARCH = {
    'm_avg':    (False, 1, 2, 0.5),
    'm_muscle': (False, 2, 3, 0.5),
    'm_heavy':  (False, 3, 2, 0.55),
    'f_avg':    (True, 1, 2, 0.45),
    'f_slim':   (True, 0, 1, 0.42),
}
REGS = ['sg', 'kr', 'jp', 'eu']          # 옷 갈래 — sg 삼국풍·kr 한국풍·jp 일본풍(동양 셋) · eu 서양
FEM_ONLY = ('dress', 'court', 'skirt', 'dancer', 'royal_f')
MODERN = ('suit', 'worksuit', 'casualsuit', 'uniform')
NEUTRAL = '#6b5a48'                       # 마네킹 옷 기본 색(게임이 tint 로 바꾼다)


def outfit_keys(female):
    keys = list(dict.fromkeys(k for r in G.ROLES.values() for k in r[0]))
    return [k for k in keys if (k in FEM_ONLY) == female and k not in ('ninja',)]


def make_all():
    G.REGION['C_east'] = G.EAST
    G.REGION['C_west'] = {'caucasian': 0.9, 'asian': 0.05, 'african': 0.05}
    G.FACTION_COLOR['C_east'] = G.FACTION_COLOR['C_west'] = NEUTRAL
    rs = []
    for arch, (female, build, height, age) in ARCH.items():
        for reg in REGS:
            east = reg in G.EAST_REG
            for key in outfit_keys(female):
                if key in MODERN and reg != 'eu':
                    continue                      # 근대 옷은 서양 갈래에만(동양 반복 방지)
                hid = f'cos_{arch}_{reg}_{key}'
                h = dict(id=hid, name=hid, era='World' if not east else 'Realm', faction='C_east' if east else 'C_west', rarity=3,
                         trait='command', might=60, wisdom=60, command=60, female=female, reg=reg,
                         axes={'height': height, 'build': build, 'head': 'long01' if female else 'short01', 'outfit': key},
                         note=f'의상 시스템 마네킹 — 칸 {arch}·갈래 {reg}·옷 틀 {key}. gen_costume_recipes.py 가 쓴다(손으로 고치지 말 것).')
                G.ROLE[hid] = 'officer'
                r = G.make(h)
                r['macro']['age'] = age
                if key == 'monk':
                    continue
                rs.append(r)
    return rs


def main():
    rs = make_all()
    # 같은 (칸, 겉옷 조각) 중복은 한 번만 — 동양 sg/kr/jp 가 같은 틀을 낼 수 있다
    seen, uniq = set(), []
    for r in rs:
        arch = '_'.join(r['id'].split('_')[1:3])
        sig = (arch, json.dumps(r.get('clothes'), sort_keys=True), json.dumps(r.get('_garments'), sort_keys=True),
               json.dumps(r.get('kitbash'), sort_keys=True), r.get('hair'))
        if sig in seen:
            continue
        seen.add(sig)
        uniq.append(r)
    if '--garments' in sys.argv:
        print(' '.join(sorted({g for r in uniq for g in r.get('_garments', [])})))
        return
    os.makedirs(OUT, exist_ok=True)
    for r in uniq:
        with open(os.path.join(OUT, r['id'] + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(r, ensure_ascii=False, indent=1) + '\n')
    per = {}
    for r in uniq:
        a = '_'.join(r['id'].split('_')[1:3])
        per[a] = per.get(a, 0) + 1
    print('COSTUME_RECIPES', len(uniq), '/', len(rs), per)


if __name__ == '__main__':
    main()
