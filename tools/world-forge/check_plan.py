"""world-forge 판별 세트표 점검 (K-0017) — data/set_plan.json 이 규칙을 지키는지, 만든 산출이 표와 맞는지 센다.

  py tools/world-forge/check_plan.py            표만 점검(칸 수·id·기존 레시피 존재·이름 규칙)
  py tools/world-forge/check_plan.py --out DIR [--web DIR] [--sprites DIR] [--budget] [--strict]
      산출 폴더에 id 별 .glb·.license.json(웹 압축본·스프라이트 .webp 도) 이 다 있는지 세고, --budget 은 툰 삼각형·용량 예산을 검사
끝 줄 `PLAN_OK slots=N assets=M new=K` 또는 `PLAN_FAIL …`. 종료 0/1.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = {'building': 3, 'prop': 3, 'terrain': 2, 'vehicle': 1}
ERAS = {'past', 'present', 'future'}
FAIL = []


def bad(msg):
    FAIL.append(msg)


def main():
    plan = json.load(open(os.path.join(HERE, 'data', 'set_plan.json'), encoding='utf-8'))
    games = plan['games']
    if sorted(games) != ['dungeon', 'forest', 'go', 'realm', 'story']:
        bad(f'판이 다섯이 아니다: {sorted(games)}')
    slots, seen = 0, {}
    for g, spec in games.items():
        for kind, want in KINDS.items():
            items = spec.get(kind, [])
            if len(items) != want:
                bad(f'{g}.{kind}: {len(items)}개 (규칙 {want})')
            for it in items:
                slots += 1
                i = it['id']
                if not re.fullmatch(r'[a-z0-9_]+', i):
                    bad(f'{g}.{kind}.{i}: id 는 영문 소문자·숫자·_')
                if kind in ('building', 'prop') and it.get('era') not in ERAS:
                    bad(f'{g}.{kind}.{i}: era 가 past/present/future 가 아니다')
                if it.get('state') not in ('exists', 'new'):
                    bad(f'{g}.{kind}.{i}: state 는 exists/new')
                if i in seen and seen[i][0] != kind:
                    bad(f'{i}: 종류가 둘({seen[i][0]}·{kind})')
                if i in seen and seen[i][1] != it.get('state'):
                    bad(f'{i}: 같은 id 의 state 가 다르다')
                seen.setdefault(i, (kind, it.get('state')))
                has = os.path.exists(os.path.join(HERE, 'recipes', i + '.json'))
                if kind == 'building' and it.get('state') == 'exists' and not has:
                    bad(f'{g}.building.{i}: exists 인데 recipes/{i}.json 이 없다')
                if it.get('state') == 'new' and kind == 'building' and has:
                    bad(f'{g}.building.{i}: new 인데 이미 recipes/ 에 있다')
    for grp in ('nature', 'village', 'field', 'dkit', 'loot', 'interior', 'furniture'):
        for i in plan.get(grp, {}).get('items', []):
            if not re.fullmatch(r'[a-z0-9_]+', i):
                bad(f'{grp}.{i}: id 는 영문 소문자·숫자·_')
            if i in seen and seen[i][0] != grp:
                bad(f'{i}: 종류가 둘({seen[i][0]}·{grp})')
            seen.setdefault(i, (grp, 'new'))
    new = sum(1 for k, s in seen.values() if s == 'new')
    def folder(flag):
        v = sys.argv[sys.argv.index(flag) + 1]
        return v if os.path.isabs(v) else os.path.join(HERE, v)

    def count(flag, exts, label):
        if flag not in sys.argv:
            return
        dirp = folder(flag)
        no2d = {i for g in plan.values() if isinstance(g, dict) and g.get('no_sprite') for i in g.get('items', [])}      # no_sprite 묶음(K-0057 3D 전용)은 2D 스프라이트 대상이 아니다
        ids = [i for i in seen if not (flag == '--sprites' and i in no2d)]
        miss = [i for i in ids if not all(os.path.exists(os.path.join(dirp, i + e)) for e in exts)]
        print(f'{label} {len(ids) - len(miss)}/{len(ids)} ({"+".join(exts)}), missing {len(miss)}')
        if miss and '--strict' in sys.argv:
            bad(f'{label} missing {len(miss)}: {", ".join(miss[:8])}...')

    count('--out', ('.glb', '.license.json'), 'toon')
    count('--web', ('.glb', '.license.json'), 'web')
    count('--sprites', ('.webp', '.license.json'), 'sprite')
    if '--budget' in sys.argv and '--out' in sys.argv:
        b = plan.get('budget', {})
        over = []
        for i in seen:
            g, lic = os.path.join(folder('--out'), i + '.glb'), os.path.join(folder('--out'), i + '.license.json')
            if not (os.path.exists(g) and os.path.exists(lic)):
                continue
            tris = json.load(open(lic, encoding='utf-8')).get('tris', 0)
            kb = os.path.getsize(g) // 1024
            nat = plan.get('nature', {})
            grp = next((g for g in ('village', 'field', 'dkit', 'loot', 'interior', 'furniture') if i in plan.get(g, {}).get('items', [])), None)
            lim = (nat.get('tris_max_big', 2500) if i in nat.get('big', []) else nat.get('tris_max', 1500)) if i in nat.get('items', []) else (plan[grp].get('tris_max', 2500) if grp else b.get('toon_tris', 5000))
            if i in ('temple_roof_01', 'plank_bridge_01'):
                lim = 2500
            if tris > lim or kb > b.get('toon_glb_mb', 0.5) * 1024:
                over.append(f'{i}(tris {tris}, {kb}KB)')
        print(f'budget over {len(over)}')
        for o in over:
            bad('budget ' + o)
    for m in FAIL:
        print('FAIL', m)
    print(f'{"PLAN_FAIL" if FAIL else "PLAN_OK"} slots={slots} assets={len(seen)} new={new}')
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
