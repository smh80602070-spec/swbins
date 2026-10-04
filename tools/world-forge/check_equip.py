"""K-0037 점검 — 장비 조각 87(갑옷 54 + 악세사리 33)의 소켓 노드(attach)·뼈 이름(VRM J_Bip)·슬롯 규약(data/equip_slots.json)·예산(삼각형·웹 ≤300KB)을 센다.

  py tools/world-forge/check_equip.py [<툰 GLB 폴더>] [<웹 GLB 폴더>]     기본 saga-assets/world/toon · saga-assets/world/web
끝 줄 EQUIP_OK/EQUIP_FAIL, 종료 0/1.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'char-forge'))


def nodes_of(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    return {x.get('name') for x in json.loads(b[20:20 + n]).get('nodes', [])}


def main():
    toon = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'saga-assets', 'world', 'toon')
    web = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, 'saga-assets', 'world', 'web')
    plan = json.load(open(os.path.join(HERE, 'data', 'set_plan.json'), encoding='utf-8'))
    slots = json.load(open(os.path.join(HERE, 'data', 'equip_slots.json'), encoding='utf-8'))
    import rigmaps
    bones = set(v for v in rigmaps.MAPS['vroid'].values() if v)
    bad = []
    for sl, d in slots['armor_slots'].items():
        if d['bone'] not in bones:
            bad.append(f'슬롯 {sl}: 뼈 {d["bone"]} 가 VRM 뼈 이름이 아니다')
    for b in slots['accessory_bones']:
        if b not in bones:
            bad.append(f'악세사리 뼈 {b} 가 VRM 뼈 이름이 아니다')
    ids = plan['equip']['items'] + plan['accessory']['items']
    for pid in ids:
        p = os.path.join(toon, pid + '.glb')
        if not os.path.exists(p):
            bad.append('없음 ' + pid)
            continue
        if 'attach' not in nodes_of(p):
            bad.append(f'{pid}: attach 노드 없음')
        lic = json.load(open(os.path.join(toon, pid + '.license.json'), encoding='utf-8'))
        if lic.get('bone') not in bones:
            bad.append(f'{pid}: 뼈 {lic.get("bone")} 가 VRM 뼈 이름이 아니다')
        lim = 600 if pid.startswith('eq_') else 500
        if lic.get('tris', 0) > lim:
            bad.append(f'{pid}: 삼각형 {lic["tris"]} > {lim}')
        if pid.startswith('eq_'):
            sl = pid.split('_')[3]
            if lic.get('bone') != slots['armor_slots'][sl]['bone'] or lic.get('mirror') != slots['armor_slots'][sl]['mirror']:
                bad.append(f'{pid}: 슬롯 규약과 뼈·거울이 다르다')
        wp = os.path.join(web, pid + '.glb')
        if os.path.exists(wp) and os.path.getsize(wp) > 300 * 1024:
            bad.append(f'{pid}: 웹 경량본 {os.path.getsize(wp) // 1024}KB > 300KB')
    print('조각', len(ids), '· 오류', len(bad))
    print('EQUIP_FAIL' if bad else 'EQUIP_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
