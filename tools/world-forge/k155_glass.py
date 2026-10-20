"""K-0155 건물 창 `glass` 재질 점검표 — 레시피 18 의 정본 GLB(world toon·web, 없으면 regions/pieces)에 glass·alphaMode BLEND 있나.
  py tools/world-forge/k155_glass.py  → tools/world-forge/_out/k155_glass.md  (출력은 PYTHONIOENCODING=utf-8 로)
"""
import glob, json, os, struct
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def gj(p):
    b = open(p, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; return json.loads(b[20:20 + n])
rows = []
for rp in sorted(glob.glob(os.path.join(R, 'tools', 'world-forge', 'recipes', '*.json'))):
    i = os.path.basename(rp)[:-5]
    cells = [i]
    for s in ('toon', 'web'):
        p = os.path.join(R, 'saga-assets', 'world', s, i + '.glb')
        if not os.path.exists(p):
            p = os.path.join(R, 'saga-assets', 'regions', 'pieces', i + '.glb')
            if s == 'web' or not os.path.exists(p):
                cells += ['(지역 조각)' if s == 'web' and os.path.exists(p) else '없음', '-', '-']; continue
            cells[0] = i + ' (`regions/pieces`)'
        j = gj(p)
        g = [m for m in j.get('materials', []) if m.get('name', '').startswith('glass')]
        names = {m.get('name') for m in g}
        tri = 0
        for m in j['meshes']:
            for pr in m['primitives']:
                if 'material' in pr and j['materials'][pr['material']].get('name', '').startswith('glass'):
                    tri += j['accessors'][pr['indices']]['count'] // 3
        cells += ['○' if g else '×', ','.join(sorted({m.get('alphaMode', 'OPAQUE') for m in g})) or '-', str(tri)]
    rows.append(cells)
allglb = glob.glob(os.path.join(R, 'saga-assets', 'world', 'toon', '*.glb'))
withg = [os.path.basename(p)[:-4] for p in allglb if any(m.get('name', '').startswith('glass') for m in gj(p).get('materials', []))]
ok = sum(1 for r in rows if r[1] == '○' and r[2] == 'BLEND')
L = ['# K-0155 건물 창 `glass` 재질 점검 (10-21)', '',
     '레시피 18(`tools/world-forge/recipes/*.json`) → `build_building.py` 298 `glass`(flat_material, rough 0.05·alpha 0.35 → glTF `alphaMode BLEND`). 엔진은 이 이름으로 창 면을 찾아 밤에 켠다.', '',
     '| 건물 id | toon glass | toon alphaMode | toon 창 삼각형 | web glass | web alphaMode | web 창 삼각형 |', '|---|---|---|---|---|---|---|']
L += ['| ' + ' | '.join(r) + ' |' for r in rows]
L += ['', f'- 레시피 18 중 toon `glass`+BLEND **{ok}/{len(rows)}**',
      f'- 정본 toon {len(allglb)} 개 중 `glass` 재질 있는 것 {len(withg)}: {", ".join(sorted(withg))}',
      '- `cafe_01`·`ferry_house_01`·`frost_lodge_01`·`frost_shrine_01`·`observatory_01` 은 world 정본이 아니라 지역 조각 `saga-assets/regions/pieces/` 에 있고 거기 glass·BLEND 있음.',
      '- `smithy_01` 정본은 레시피 판이 아니라 `build_village_k126.py`(K-0126 대장간 돌 몸채)가 만든 것이라 창 면 없음 — 레시피 판은 안 구움(같은 id).',
      '- 레시피 없는 건물(K-0125·0126·0141 마을 소품·랜드마크 등)은 창 면이 따로 없음이 맞다 — 새로 만들지 않음(티켓 범위 밖).',
      '- `forest_cottage_01`(3마을 집)에 glass 있음 — G-0251 메모 "3마을 집 창 자리 없음" 은 틀림.']
open(os.path.join(R, 'tools', 'world-forge', '_out', 'k155_glass.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
print('GLASS', ok, len(rows))
