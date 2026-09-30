"""char-forge 단계 4-b — 사가국지 장수 194(도감 밖) → 사실 몸 레시피 194(recipes/realm/hero_<id>.json).

    py tools/char-forge/gen_realm_recipes.py            # 레시피를 새로 쓴다(키 값은 calib_height.py 가 맞춘다)
    py tools/char-forge/gen_realm_recipes.py --check    # 쓴 레시피를 다시 읽어 실루엣 네 축 검사만(도감 105 와도)
    py tools/char-forge/gen_realm_recipes.py --garments # 지을 공방 옷 인자(garments.py -- all $(…))

도감 105 와 같은 생성기(`gen_hero_recipes.py`)의 `assign`·`make` 를 그대로 쓴다 — 여기서는 명단만 다르다:
  · 명단·능력 = saga-web/saga-realm/js/data-force.js(노드로 읽는다), 성별·머리색 = 초상 배치(`tools/ai-art/batches/web_realm_194.json`)의 글
    (초상과 몸이 같은 사람이 되게 — 초상은 글만으로 만들어졌고 몸이 그것을 따른다)
  · 세력 접두(rf·kr2·jp·jiao…) → 옷 갈래(reg)·인종 비율·옷 색·역할(무예·지략·통솔·덕·매력 × 성별 × 희귀도)
  · 실루엣 네 축은 도감 105 의 축까지 포함해 둘 이상 달라야 한다(사용자 기준 "색만 다른 건 다른 게 아니다")
이름 정책: 가명·id 만 쓴다.
"""
import json
import os
import subprocess
import sys

import gen_hero_recipes as G

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(ROOT))
OUT = os.path.join(ROOT, 'recipes', 'realm')
BATCH = os.path.join(REPO, 'tools', 'ai-art', 'batches', 'web_realm_194.json')

# 접두 → (옷 갈래 reg, 시대 표지, 인종 비율, 옷 색 후보)
EAST = G.EAST
P = {
    'rf':   ('sg', 'Realm', EAST, ['#3f6b3a', '#2f4a7a', '#8a2f2a', '#5a3a5a', '#6b5a48']),
    'kr2':  ('kr', 'Realm', EAST, ['#e8e2d0', '#7a2a24', '#2f6a6a', '#9a7a2a', '#4a3a6a']),
    'jp':   ('jp', 'Realm', EAST, ['#8a2a2a', '#3a4a3a', '#2a3a5a', '#9a7a2a', '#6a3a6a']),
    'jiao': ('wd', 'World', {'asian': 0.7, 'caucasian': 0.05, 'african': 0.25}, ['#2a6a5a', '#8a5a2a', '#4a6a3a', '#9a7a2a']),
    'nz':   ('wd', 'World', {'asian': 0.6, 'african': 0.3, 'caucasian': 0.1}, ['#7a5a2a', '#6a3a2a', '#3a5a3a', '#8a4a2a']),
    'tz':   ('wd', 'World', {'caucasian': 0.45, 'asian': 0.35, 'african': 0.2}, ['#c07a2a', '#8a2a3a', '#2a6a4a', '#9a7a2a']),
    'mb':   ('wd', 'World', {'asian': 0.7, 'caucasian': 0.25, 'african': 0.05}, ['#3a5a8a', '#6a4a2a', '#5a5a48', '#8a3a2a']),
    'xb':   ('wd', 'World', {'asian': 0.75, 'caucasian': 0.2, 'african': 0.05}, ['#5a4a3a', '#3a4a5a', '#8a3a2a', '#4a5a3a']),
    'ly':   ('wd', 'World', {'asian': 0.8, 'african': 0.15, 'caucasian': 0.05}, ['#9a7a2a', '#2a5a6a', '#8a3a4a', '#4a6a3a']),
    'nh':   ('wd', 'World', {'asian': 0.6, 'african': 0.3, 'caucasian': 0.1}, ['#2a5a8a', '#8a6a2a', '#3a7a6a', '#7a3a2a']),
    'xiyu': ('wd', 'World', {'caucasian': 0.6, 'asian': 0.25, 'african': 0.15}, ['#3a4a8a', '#8a2a2a', '#2a6a4a', '#c09a2a']),
    'sl':   ('wd', 'World', {'caucasian': 0.55, 'asian': 0.3, 'african': 0.15}, ['#6a3a6a', '#c07a2a', '#2a6a6a', '#8a2a3a']),
    'dj':   ('eu', 'World', {'caucasian': 0.9, 'asian': 0.05, 'african': 0.05}, ['#2a4a8a', '#e6e0d0', '#6a2a3a', '#2a6a5a']),
    'fu':   ('eu', 'World', {'caucasian': 0.85, 'asian': 0.1, 'african': 0.05}, ['#4a5a9a', '#6a4a9a', '#2a7a8a', '#9a9ab0']),
    'ru':   ('eu', 'World', {'caucasian': 0.85, 'asian': 0.05, 'african': 0.1}, ['#4a4a3a', '#5a4a3a', '#3a4a3a', '#6a5a4a']),
    'tb':   ('eu', 'World', {'caucasian': 0.85, 'asian': 0.1, 'african': 0.05}, ['#d8d4c4', '#9aa4b0', '#4a5a6a', '#6a6a78']),
}
NOMAD = ('mb', 'xb')
WESTERN_TRADE = ('xiyu', 'sl', 'nh')
FANTASY = ('fu', 'ru', 'tb')


def role_of(pre, female, trait, rarity, hs):
    east = pre in ('rf', 'kr2', 'jp')
    if female:
        if trait in ('might', 'command'):
            return 'warrior_f'
        if trait == 'virtue':
            return 'queen' if rarity >= 4 else 'lady'
        if trait == 'charm':
            return 'court' if rarity >= 4 else 'dancer'
        return 'lady' if (hs >> 3) & 1 else 'court'          # wisdom
    if trait == 'might':
        return 'samurai' if pre == 'jp' else 'nomad' if pre in NOMAD else 'tribal' if pre == 'nz' else \
            'hoplite' if pre == 'dj' else 'warrior'
    if trait == 'command':
        return 'samurai' if pre == 'jp' else 'nomad' if pre in NOMAD else 'roman' if pre == 'dj' and (hs >> 4) & 1 else \
            'general'
    if trait == 'wisdom':
        if pre in ('xiyu', 'sl', 'tz'):
            return 'scholar' if (hs >> 5) & 1 else 'healer'
        return 'strategist'
    if trait == 'virtue':
        if rarity >= 4:
            return 'khan' if pre in NOMAD else 'sultan' if pre in ('xiyu', 'tz', 'sl') else 'king'
        return 'monk' if pre in ('kr2', 'tz') and (hs >> 6) & 1 else 'scholar'
    # charm
    return 'traveler' if pre in WESTERN_TRADE else 'artist' if not east else 'court' if False else 'artist'


def load_rows():
    js = r"""
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=process.argv[1];
const g={};g.window=g;g.DG={};const ctx=vm.createContext(g);
for (const f of ['data.js','data-force.js']) vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const F=g.DG.forceData, out={};
for (const k of Object.keys(F)) { const v=F[k]; if (Array.isArray(v)) for (const o of v) if (o && o.id && o.name) out[o.id]={id:o.id,name:o.name,rarity:o.rarity,trait:o.trait,stats:o.stats||{}}; }
console.log(JSON.stringify(Object.values(out)));
"""
    r = subprocess.run(['node', '-e', js, os.path.join(REPO, 'saga-web', 'saga-realm', 'js')], capture_output=True, text=True, encoding='utf-8')
    if not r.stdout.strip():
        sys.exit('node 실패: ' + r.stderr[:400])
    return {o['id']: o for o in json.loads(r.stdout)}


def load_realm():
    rows = load_rows()
    batch = json.load(open(BATCH, encoding='utf-8'))['items']
    heroes = []
    for it in sorted(batch, key=lambda x: x['id']):
        pid = it['id']
        o = rows.get(pid)
        if not o:
            sys.exit(f'{pid}: data-force.js 에 없다')
        pre = pid.split('_')[0]
        if pre not in P:
            sys.exit(f'{pid}: 접두 {pre} 표 없음')
        hs = G.fnv(pid)
        female = '1girl' in it['prompt']
        reg, era, race, colors = P[pre]
        fac = 'R_' + pre
        G.REGION[fac] = race
        G.FACTION_COLOR[fac] = colors[(hs >> 7) % len(colors)]
        role = role_of(pre, female, o.get('trait') or 'command', o.get('rarity') or 3, hs)
        G.ROLE[pid] = role
        heroes.append(dict(id=pid, name=o['name'], era=era, faction=fac, rarity=o.get('rarity') or 3, trait=o.get('trait'),
                           might=(o['stats'] or {}).get('might', 60), wisdom=(o['stats'] or {}).get('wisdom', 60),
                           command=(o['stats'] or {}).get('command', 60), female=female, reg=reg,
                           note=f"단계 4-b 사가국지 장수 몸 — saga-web/saga-realm 장수 id {pid}(가명 {o['name']}). 역할 {role}·{pre}·★{o.get('rarity')}. "
                                f"gen_realm_recipes.py 가 쓴다(손으로 고치지 말 것 — 생성기를 고친다)."))
    return heroes


def dex_axes():
    d = os.path.join(ROOT, 'recipes', 'hero')
    out = []
    for f in sorted(os.listdir(d)):
        if f.startswith('hero_') and f.endswith('.json'):
            out.append(G.axes_of(json.load(open(os.path.join(d, f), encoding='utf-8'))))
    return out


def main():
    if '--check' in sys.argv:
        rs = [json.load(open(os.path.join(OUT, f), encoding='utf-8')) for f in sorted(os.listdir(OUT)) if f.endswith('.json')]
        dex = [json.load(open(os.path.join(ROOT, 'recipes', 'hero', f), encoding='utf-8')) for f in sorted(os.listdir(os.path.join(ROOT, 'recipes', 'hero'))) if f.startswith('hero_')]
        sys.exit(0 if G.check(dex + rs) else 1)
    heroes = load_realm()
    G.assign(heroes, dex_axes())
    if '--garments' in sys.argv:
        print(' '.join(sorted({g for h in heroes for g in G.make(h).get('_garments', [])})))
        return
    os.makedirs(OUT, exist_ok=True)
    rs = []
    for h in heroes:
        r = G.make(h)
        p = os.path.join(OUT, r['id'] + '.json')
        if os.path.exists(p):  # 보정한 키 값은 이어 받는다(같은 목표 키일 때만)
            old = json.load(open(p, encoding='utf-8'))
            if old.get('height_target_m') == r['height_target_m'] and old.get('macro', {}).get('age') == r['macro']['age'] \
                    and old['macro'].get('muscle') == r['macro']['muscle'] and old['macro'].get('weight') == r['macro']['weight']:
                r['macro']['height'] = old['macro'].get('height', 0.5)
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(r, ensure_ascii=False, indent=1) + '\n')
        rs.append(r)
    for r in rs:
        a = r['axes']
        print(f"{r['id']:<22} 키{a['height']} {G.BUILD_NAME[a['build']]:<2} {a['head']:<11} {a['outfit']}")
    dex = [json.load(open(os.path.join(ROOT, 'recipes', 'hero', f), encoding='utf-8')) for f in sorted(os.listdir(os.path.join(ROOT, 'recipes', 'hero'))) if f.startswith('hero_')]
    sys.exit(0 if G.check(dex + rs) else 1)


if __name__ == '__main__':
    main()
