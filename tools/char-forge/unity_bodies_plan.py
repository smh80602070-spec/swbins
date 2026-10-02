"""Unity 몸 61벌 교체 계획표 생성 (K-0018) — data/unity_bodies.json.

사용자 결정(2026-10-02): "VRoid 로 변경하고 Mixamo 제거". 그래서
  · 사람 자리(40) = VRoid 몸(`saga-godot/assets/characters_vroid` 26명 + 공방 사람 2명)
  · 사람 아닌 자리(21: 괴물·두목 괴수·로봇·시체·정령·외계) = 공방 몸(`_cmp_real_<이름>_01`) 그대로 — VRoid 는 사람꼴뿐이라
역할·성별은 recipes/_cmp_real_*.json 의 `_note`·`macro.gender` 에서 읽는다(새로 짓지 않는다).

  py tools/char-forge/unity_bodies_plan.py            # data/unity_bodies.json 을 다시 쓴다
VRoid 몸이 26명이라 같은 몸이 여러 자리에 겹친다 → 겹침은 "variant" 로 표시(옷 조각·색 변주는 K-0022 쪽).
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'unity_bodies.json')

# VRoid 풀 — 2026-10-02 렌더를 눈으로 보고 가른 성별(여 16·남 10)
FEMALE = 'abdefhijkmoqsuwy'
MALE = 'cglnprtvxz'

# 사람 자리 → VRoid 글자(몸 id = avatar_sample_<글자>)
HUMAN = {
    'aliensoldier': 't', 'blackknight': 'r', 'brawler': 'c', 'castleguard': 't', 'chrononaut': 'l', 'courier': 'g',
    'enforcer': 'p', 'exored': 't', 'furchief': 'x', 'ganfaul': 'v', 'gasmask': 'c', 'junkpeddler': 'n', 'martialist': 'x',
    'mechanic': 'g', 'merc': 't', 'morak': 'x', 'ninja': 'c', 'paladin': 'r', 'patrol': 't', 'pilgrim': 'p', 'rider': 'c',
    'rioter': 'g', 'riotswat': 't', 'scout': 'x', 'sentry': 'p', 'suit': 'p', 'surveyor': 'l', 'tourist': 'z',
    'archer_f': 'k', 'castaway_f': 'y', 'chrononaut_f': 's', 'courier_f': 'm', 'goldexo_f': 'q', 'hero_f': 'b',
    'hoodedcloak_f': 'j', 'leatherknight_f': 'd', 'mage_f': 'o', 'photographer_f': 'a', 'phototourist_f': 'w',
    'punk_f': 'u', 'swordmaiden_f': 'i', 'timepeddler_f': 'f',
}
# 사람 아닌 자리 → 공방 몸 유지(종류 표시)
CREATURE = {
    'brute': 'creature', 'demon': 'creature', 'goblin': 'creature', 'maw': 'creature', 'warrok': 'creature',
    'parasite': 'creature', 'rockgiant': 'creature', 'skeleton': 'undead', 'copzombie': 'undead', 'warzombie': 'undead',
    'nightshade': 'spirit', 'fairy': 'spirit', 'colossus': 'robot', 'crashdummy': 'robot', 'steelbot': 'robot',
    'testbot': 'robot', 'plasma': 'alien', 'starguest': 'alien', 'visitor': 'alien',
}


def vroid_file(letter):
    return 'AvatarSample_A.glb' if letter == 'a' else f'avatar_sample_{letter}.glb'


def main():
    rows, used = [], {}
    for f in sorted(glob.glob(os.path.join(HERE, 'recipes', '_cmp_real_*.json'))):
        rid = os.path.basename(f)[:-5]
        key = rid[len('_cmp_real_'):-3]
        d = json.load(open(f, encoding='utf-8'))
        note = str(d.get('_note', ''))
        m = re.search(r'saga-unity ([^(]+?)\(', note)
        role = re.search(r'자리 후보\(([^)]*)\)', note)
        g = d.get('macro', {}).get('gender')
        row = {'recipe': rid, 'mixamo': (m.group(1).strip() if m else '?'), 'role': (role.group(1) if role else '').strip(),
               'gender': 'M' if (g is not None and g >= 0.5) else 'F'}
        if key in HUMAN:
            L = HUMAN[key]
            pool = FEMALE if row['gender'] == 'F' else MALE
            assert L in pool, f'{key}: 성별 {row["gender"]} 인데 VRoid {L} 는 반대 풀'
            row['kind'] = 'human'
            row['replace'] = {'type': 'vroid', 'id': f'avatar_sample_{L}', 'file': vroid_file(L),
                              'unity': 'Assets/Art/CharactersVroid/' + vroid_file(L)}
            used.setdefault(L, []).append(key)
        elif key in CREATURE:
            row['kind'] = CREATURE[key]
            row['replace'] = {'type': 'forge', 'id': rid, 'note': '사람 아닌 몸 — 공방 몸 유지(VRoid 는 사람꼴뿐)'}
        else:
            raise SystemExit(f'분류 안 된 자리: {key}')
        rows.append(row)
    for r in rows:
        if r['replace']['type'] == 'vroid':
            r['variant'] = len(used[r['replace']['id'][-1]]) > 1
    out = {
        'version': 1,
        'decision': '2026-10-02 사용자: Unity 사람 몸은 VRoid 로 바꾸고 Mixamo 는 제거한다(K-0018). 사람 아닌 몸은 공방 몸 유지.',
        'vroid_pool': {'female': list(FEMALE), 'male': list(MALE), 'folder': 'Assets/Art/CharactersVroid'},
        'counts': {'total': len(rows), 'human': sum(r['kind'] == 'human' for r in rows),
                   'non_human': sum(r['kind'] != 'human' for r in rows), 'vroid_bodies_used': len(used)},
        'bodies': rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('UNITY_BODIES', json.dumps(out['counts'], ensure_ascii=False))
    over = {k: v for k, v in used.items() if len(v) > 1}
    print('겹침(변주 필요):', {k: len(v) for k, v in over.items()})


if __name__ == '__main__':
    sys.exit(main())
