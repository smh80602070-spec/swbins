"""K-0160 계획 생성(1회) — 1만리 beast_* 128 ↔ 짐승 몸 짝 · still 짐승 · 도감 60."""
import json, os, re, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
os.chdir(ROOT)
base = json.load(open('tools/char-forge/recipes/factory/k158_trial.json', encoding='utf-8'))
common = {k: base[k] for k in ('px', 'ndir', 'dirs', 'dir_names', 'foot', 'style', 'style_ref', 'clips', 'canon')}
common['ortho'] = 2.5
creature = {'act': base['creature']['act']}
names = sorted(f[6:-4] for f in os.listdir('saga-web/saga-go/assets/sprites2d') if f.startswith('beast_') and f.endswith('.png'))
glbs = {os.path.basename(p)[:-4]: p.replace(os.sep, "/") for p in glob.glob('saga-assets/creatures3d/*.glb')}
pets = {os.path.basename(p)[4:-4]: p.replace(os.sep, "/") for p in glob.glob('saga-assets/pets3d/pet_*.glb')}
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())
# 이름이 몸 id 와 다른 것(라이선스 replaces·K-0096 표 근거)
MANUAL = {'Alien': 'alien_grunt', 'BlueDemon': 'demon_blue', 'Demon': 'demon_red', 'Dino': 'dino_pet',
          'Fish1': 'fish_a', 'Fish2': 'fish_b', 'Fish3': 'fish_c', 'Orc': 'orc_warrior', 'Wizard': 'hat_wizard',
          'Velociraptor': 'raptor', 'ShibaInu': 'shiba', 'Shark_x2': 'great_white'}
# 같은 몸 다른 그림(색 변형·두 마리) → 앞 풀을 같이 쓴다(한 번만 굽기)
ALIAS = {'Alien_2': 'Alien', 'Koi_x2': 'Koi', 'Snake_angry': 'Snake'}
nmap = {norm(k): k for k in glbs}
pairs, missing, aliases, pools = {}, [], {}, []
for n in names:
    if n in ALIAS:
        aliases['beast_' + n] = 'beast_' + ALIAS[n]; continue
    if n.startswith(('pk_', 'pt_')):
        g = pets.get(n)
    else:
        k = MANUAL.get(n) or nmap.get(norm(n))
        g = glbs.get(k) if k else None
    if not g:
        missing.append('beast_' + n); continue
    pid = 'beast_wolf' if n == 'Wolf' else 'beast_' + n     # 윈도 대소문자 — 2나락 beast_wolf 와 같은 몸·같은 풀
    if pid != 'beast_' + n:
        aliases['beast_' + n] = pid
    pairs['beast_' + n] = g
    lj = g[:-4] + '.license.json'
    pools.append({'id': pid, 'type': 'creature', 'glb': g, 'license_json': lj if os.path.exists(lj) else None,
                  'still_img': 'saga-web/saga-go/assets/sprites2d/beast_' + n + '.png'})
FIX = {   # K-0160 눈 판정·판정기 뒤 다시 굽기: 칸 잘림(attack·attack2 돌진·앞발) → cap, 꼬리 → margin, 어두운 옆 결 → auto_side
    **{k: {'cap': 1.7} for k in ('Coral_Grouper', 'Dragon_Evolved', 'Horse', 'Monkey', 'Stag', 'Triceratops', 'Dino', 'Orc', 'Wasp',
                                 'pk_alakazam', 'pk_gengar', 'pk_lapras', 'pk_snorlax')},
    'Rat': {'margin': 1.45},
    # 눈으로 본 뒤(10-21): 얇은 몸이 뒤집히는 맞음·구르는 쓰러짐·폴짝 돌진 — 정상 동작이라 판정기 spin
    **{k: {'spin_roles': ['hit', 'death', 'attack', 'attack2']} for k in ('Betta', 'Blue_Tang', 'Fish1', 'Fish2', 'Goblin_Shark', 'Humphead',
                                                                         'Robot_Large', 'Royal_Gramma', 'Sunfish', 'Tetra', 'pk_magikarp')},
    'Manta_ray': {'cap': 1.7, 'spin_roles': ['idle', 'hit', 'death', 'attack', 'attack2']},   # 10-22 납작한 몸 뒤집기 + 돌진 칸 잘림 · 앞모습 날갯짓에 흰 배(밝기 0.14)
    **{k: {'auto_side': True} for k in ('Bull', 'Cow', 'Bear', 'Pug', 'Husky', 'Horse_White', 'pk_mew')},
}
for p in pools:
    p.update(FIX.get(p['id'][6:], {}))
common['clips'] = json.loads(json.dumps(common['clips']))
common['clips']['attack2']['spin'] = True     # 짐승 Special = 제자리 한 바퀴·뛰어오르기 — 판정기 spin(등·배 번갈아)
plan = dict(common, note='K-0160 공장 ③ — 1만리 들판 짐승(assets/sprites2d/beast_*.png 96px 한 장 그림, 128장)을 같은 그림체 시트로. 몸 = saga-assets/creatures3d·pets3d 자체 3D(K-0096·K-0120·K-0122·K-0145, 동작 7 자기 뼈대). 짝 = pairs, 같은 몸 다른 그림 = aliases(웹은 alias 풀을 씀), 몸 없음 = missing. 짝은 K-0114 표(tools/world-forge/data/k114_beasts.json)와 같고, 거기서 null(사람꼴 괴물 8)이던 것은 K-0122·K-0145 자체 몸(빌린 Quaternius 대체 — 지금 그림과 다른 몸). 생성: tools/char-forge/recipes/factory/gen_k160.py(1회)',
            ticket='K-0160', game='saga-go', creature=creature, pairs=pairs, aliases=aliases, missing=missing,
            pools=[p for p in pools if p['id'] != 'beast_wolf'] + [p for p in pools if p['id'] == 'beast_wolf'],
            deploy={'saga-web/saga-go/assets/sprites2d_sheets': None})
for p in plan['pools']:
    if not p['license_json']: p.pop('license_json')
json.dump(plan, open('tools/char-forge/recipes/factory/k159_beasts.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('beasts', len(names), 'pools', len(pools), 'alias', len(aliases), 'missing', missing)

# still 짐승 다섯(2나락 셋 + 4종횡 둘 — 4종횡 그림은 2나락과 md5 같음)
st = dict(common, note='K-0160 — still 짐승 2나락 beast_dog·beast_wolf·beast_big + 4종횡 beast_dog·beast_wolf(같은 그림 md5). 몸 = 눈으로 고름: 흰 크림 말린 꼬리 개 → shiba, 회색 늑대 → wolf(K-0158 풀 그대로), 갈색 큰 곰 → bear(검은 곰 몸이라 tint — style_pass colorize 로 그림의 갈색)',
          ticket='K-0160', game='saga-dungeon', creature=creature,
          pools=[{'id': 'beast_dog', 'type': 'creature', 'glb': 'saga-assets/creatures3d/shiba.glb', 'license_json': 'saga-assets/creatures3d/shiba.license.json'},
                 {'id': 'beast_wolf', 'type': 'creature', 'glb': 'saga-assets/creatures3d/wolf.glb', 'license_json': 'saga-assets/creatures3d/wolf.license.json'},
                 {'id': 'beast_big', 'type': 'creature', 'glb': 'saga-assets/creatures3d/bear.glb', 'license_json': 'saga-assets/creatures3d/bear.license.json', 'tint': [150, 118, 98, 0.85]}],
          deploy={'saga-web/saga-dungeon/assets/sprites2d_sheets': ['beast_dog', 'beast_wolf', 'beast_big'],
                  'saga-web/saga-story/assets/sprites2d_sheets': ['beast_dog', 'beast_wolf']})
json.dump(st, open('tools/char-forge/recipes/factory/k159_still_beasts.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
