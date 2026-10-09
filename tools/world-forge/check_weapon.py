"""K-0030 점검 — 무기 27벌 GLB 의 소켓 노드 규약(grip·tip·up, 활 nock·tip_low, 방패 face)과 예산(삼각형·웹 경량본 ≤0.3MB)을 센다.

  py tools/world-forge/check_weapon.py [<툰 GLB 폴더>] [<웹 GLB 폴더>]     기본 saga-assets/world/toon · saga-assets/world/web
끝 줄 WEAPON_OK/WEAPON_FAIL, 종료 0/1.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
KINDS = ('sword', 'spear', 'axe', 'dagger', 'bow', 'staff', 'gun', 'shield', 'gauntlet')
GRADES = ('common', 'rare', 'legend')
NEED = {'bow': {'grip', 'tip', 'tip_low', 'nock', 'up'}, 'shield': {'grip', 'tip', 'face', 'up'}}


def nodes_of(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    return {x.get('name') for x in j.get('nodes', [])}


def main():
    toon = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'saga-assets', 'world', 'toon')
    web = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, 'saga-assets', 'world', 'web')
    bad = []
    for k in KINDS:
        for g in GRADES:
            pid = f'wpn_{k}_{g}'
            p = os.path.join(toon, pid + '.glb')
            if not os.path.exists(p):
                bad.append('없음 ' + pid)
                continue
            miss = NEED.get(k, {'grip', 'tip', 'up'}) - nodes_of(p)
            if miss:
                bad.append(f'{pid}: 노드 없음 {sorted(miss)}')
            lic = json.load(open(os.path.join(toon, pid + '.license.json'), encoding='utf-8'))
            if lic.get('tris', 0) > 1500:
                bad.append(f'{pid}: 삼각형 {lic["tris"]} > 1500')
            wp = os.path.join(web, pid + '.glb')
            if os.path.exists(wp) and os.path.getsize(wp) > 300 * 1024:
                bad.append(f'{pid}: 웹 경량본 {os.path.getsize(wp) // 1024}KB > 300KB')
            if os.path.exists(wp) and NEED.get(k, {'grip', 'tip', 'up'}) - nodes_of(wp):   # 압축이 소켓 노드를 지우면 안 된다(K-0088)
                bad.append(f'{pid}: 웹 경량본 노드 없음 {sorted(NEED.get(k, {"grip", "tip", "up"}) - nodes_of(wp))}')
    print('무기', len(KINDS) * len(GRADES), '· 오류', len(bad))
    print('WEAPON_FAIL' if bad else 'WEAPON_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
