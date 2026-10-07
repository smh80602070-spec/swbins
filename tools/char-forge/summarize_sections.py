"""VRoid 몸 단면 요약 (K-0081) — measure_vroid_section.py 결과를 엔진 배율 k(머리 뼈 높이/1.5)로 나눠 남·녀 중앙값·90분위로 접고,
장비 조각 기준 몸 표 `tools/world-forge/data/equip_body_ref.json` 을 쓴다(build_equip.py 가 읽어 조각을 몸에 맞춘다).

  py tools/char-forge/summarize_sections.py <sections.json> [--write]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
src = sys.argv[1]
d = {k: v for k, v in json.load(open(src, encoding='utf-8')).items() if 'error' not in v}
plan = {e['id']: e['gender'] for e in json.load(open(os.path.join(HERE, 'data', 'outfit_swap_plan.json'), encoding='utf-8'))['entries']}


def q(vals, p):
    v = sorted(x for x in vals if x is not None)
    return round(v[min(len(v) - 1, int(p * (len(v) - 1) + 0.5))], 4) if v else None


def collect(ids):
    out = {}
    for key in ('neck_dz', 'upperchest_dz', 'spine_dz', 'hips_dz', 'shoulder_x'):
        vals = [d[i][key] / d[i]['k'] for i in ids]
        out[key] = {'p10': q(vals, 0.1), 'p50': q(vals, 0.5), 'p90': q(vals, 0.9)}
    rows = {}
    for i in ids:
        k = d[i]['k']
        for r in d[i]['torso']:
            if 'rx' not in r:
                continue
            zz = round(r['dz'] / k / 0.05) * 0.05                       # k 로 나눈 높이를 0.05 칸에 다시 묶는다
            rows.setdefault(round(zz, 2), []).append((r['rx'] / k, r['front'] / k, r['back'] / k, r['cy'] / k))
    out['torso'] = {str(z): {'n': len(v), 'rx90': q([a[0] for a in v], 0.9), 'front90': q([a[1] for a in v], 0.9), 'back90': q([a[2] for a in v], 0.9),
                             'rx50': q([a[0] for a in v], 0.5), 'cy50': q([a[3] for a in v], 0.5)} for z, v in sorted(rows.items()) if len(v) >= max(5, len(ids) // 10)}
    for limb in ('upperarm', 'lowerarm', 'upperleg', 'lowerleg'):
        out[limb] = {m: {'p50': q([d[i]['limbs'][limb][m] / d[i]['k'] for i in ids], 0.5), 'p90': q([d[i]['limbs'][limb][m] / d[i]['k'] for i in ids], 0.9)} for m in ('len', 'r90', 'r50')}
    for part in ('foot', 'head'):
        out[part] = {m: {'p50': q([d[i][part][m] / d[i]['k'] for i in ids], 0.5), 'p90': q([d[i][part][m] / d[i]['k'] for i in ids], 0.9)} for m in d[ids[0]][part]}
    out['k'] = {'p10': q([d[i]['k'] for i in ids], 0.1), 'p50': q([d[i]['k'] for i in ids], 0.5), 'p90': q([d[i]['k'] for i in ids], 0.9)}
    return out


groups = {'all': list(d), 'M': [i for i in d if plan.get(i) == 'M'], 'F': [i for i in d if plan.get(i) == 'F']}
summ = {g: dict(n=len(ids), **collect(ids)) for g, ids in groups.items() if ids}
doc = {'note': 'K-0081 — VRoid 몸 단면(dex·realm 299, 옷 포함 바깥면)을 엔진 배율 k(머리 뼈 높이/1.5)로 나눈 값. 좌표: 가슴뼈(J_Bip_C_Chest) 머리 기준, Z 위·앞 −Y, m. '
               '생성: py tools/char-forge/summarize_sections.py <measure_vroid_section.py 결과> --write. build_equip.py 가 조각 맞춤에 쓴다.',
       'source_bodies': len(d), 'groups': summ}
print(json.dumps({g: {k: v for k, v in s.items() if k != 'torso'} for g, s in summ.items()}, ensure_ascii=False, indent=1)[:4000])
for g in ('M', 'F'):
    if g in summ:
        print(g, 'torso', json.dumps(summ[g]['torso'], ensure_ascii=False))
if '--write' in sys.argv:
    p = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'equip_body_ref.json')
    json.dump(doc, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('쓰기', p)
