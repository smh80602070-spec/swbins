"""K-0170 계획 생성 — 2나락 적 body 중 2D 종 시트 없는 것(W-0354 메모 줄 그대로) ↔ 종 몸 glb(K-0121 초상 짝 표 k121_targets.json).

  py tools/char-forge/recipes/factory/gen_k170.py   → recipes/factory/k170_dungeon45.json
같은 종 몸을 쓰는 body 여럿(cactoro·cactoro_2 등)은 한 번 굽고 aliases(웹 index.json factory_alias). 짝 없는 body 는 missing.
"""
import glob
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
os.chdir(ROOT)
memo = open('tasks/web/done/W-0354.md', encoding='utf-8').read()
line = [x for x in memo.splitlines() if '2D 종 시트 없는 body' in x][0]
names = list(dict.fromkeys(re.findall(r'([a-z][a-z0-9_]*)(?:×\d+)?', line.split(':', 1)[1])))
t = json.load(open('tools/ai-art/data/k121_targets.json', encoding='utf-8'))
pair = {r['body']: r['creature'] for k in ('species', 'species_k144', 'species_k145') for r in t.get(k, [])}
glbs = {os.path.basename(p)[:-4]: p.replace(os.sep, '/') for p in glob.glob('saga-assets/creatures3d/*.glb')}
base = json.load(open('tools/char-forge/recipes/factory/k159_beasts.json', encoding='utf-8'))   # K-0160 짐승 규격 그대로(attack2 spin 포함)
# 공장 출력 폴더는 한 곳(윈도 대소문자 무시) — 다른 계획 풀과 이름이 겹치면:
#   같은 몸 → 그 풀을 그대로 2나락에도 놓고 별칭(다시 안 굽음) · 다른 몸 → 새 이름(웹 body 짝은 수신함)
other, KNOB = {}, {}
for f in ('k159_beasts.json', 'k159_still_beasts.json'):
    for x in json.load(open('tools/char-forge/recipes/factory/' + f, encoding='utf-8'))['pools']:
        other[x['id'].lower()] = (x['id'], x['glb'])
        if f == 'k159_beasts.json':                 # 같은 몸에 K-0160 눈 판정으로 붙인 손잡이(cap·margin·auto_side·spin_roles)를 물려받음
            KNOB[x['glb']] = {k: x[k] for k in ('cap', 'margin', 'auto_side', 'spin_roles') if k in x}
RENAME = {'beast_big': 'dg_elephant'}      # still beast_big(곰 — 일반 큰 짐승 그림)과 다른 몸(코끼리병 초상 = elephant)
# 10-22 첫 판정 뒤: attack 돌진(옆 f4)이 칸 끝 → cap · 게 한 번 들이받기(이동 0.08) 눈 ○ → 면제
FIX = {**{k: {'cap': 1.7} for k in ('cactoro', 'cthulhu', 'green_blob', 'mushnub_evolved')}, 'goleling_evolved': {'waive': {'crop': '뒤대각 돌진 f4 발이 칸 아래 끝에 닿음 — cap 1.7·2.2 같은 값, 눈으로 잘림 없음', 'border': '같은 칸', 'flicker': '같은 돌진(이동 0.08)'}},
       'crab': {'waive': {'flicker': 'attack 옆 f4 — 앞으로 한 번 들이받는 돌진(이동 0.08), 정상'}}}
pools, aliases, missing, first = [], {}, [], {}
for b in names:
    c = pair.get(b)
    g = glbs.get(c) if c else None
    if not g:
        missing.append(b)
        continue
    if c in first:
        aliases[b] = first[c]
        continue
    o = other.get(b.lower())
    if o and o[1] == g:
        first[c] = o[0]
        if o[0] != b:
            aliases[b] = o[0]
        b = o[0]
    else:
        b = RENAME.get(b, b)
        first[c] = b
    lj = g[:-4] + '.license.json'
    p = dict({'id': b, 'type': 'creature', 'glb': g}, **KNOB.get(g, {}), **FIX.get(b, {}))
    if os.path.exists(lj):
        p['license_json'] = lj
    pools.append(p)
plan = {k: base[k] for k in ('px', 'ndir', 'dirs', 'dir_names', 'foot', 'style', 'style_ref', 'clips', 'canon', 'ortho', 'creature')}
plan.update(note='K-0170 — 2나락 적 2D 종 시트(W-0354 메모 "2D 종 시트 없는 body" 줄 · 몸 = K-0121 초상 짝 표 species·k144·k145 → saga-assets/creatures3d). '
                 '규격 = K-0160 짐승(k159_beasts). 같은 종 몸 body 는 aliases. 생성: recipes/factory/gen_k170.py',
            ticket='K-0170', game='saga-dungeon', pools=pools, aliases=aliases, missing=missing,
            deploy={'saga-web/saga-dungeon/assets/sprites2d_sheets': None})
json.dump(plan, open('tools/char-forge/recipes/factory/k170_dungeon45.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('bodies', len(names), 'pools', len(pools), 'aliases', aliases, 'missing', missing)
