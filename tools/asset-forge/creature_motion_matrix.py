"""펫·몬스터·탈것 몸 × 표준 동작 현황표(K-0031 단계 1) — 파일의 클립 이름을 읽어 표로 만든다. 읽기만 한다(추측 없음).

    py tools/asset-forge/creature_motion_matrix.py            # data/creature_motion_matrix.json + 요약
    py tools/asset-forge/creature_motion_matrix.py --names    # 종 이름·클립 이름만 훑어 본다

대상: git 추적 중인 GLB/GLTF 로 웹 다섯 판 `models/animals*/` · `models/monsters/**` · `models/foes/` + saga-unity `Art/Creatures/`.
같은 내용(md5)은 한 번만 세고 어느 판에 있는지만 적는다. 클립 이름은 소문자 낱말 규칙으로 표준 동작 일곱 칸에 맞춘다:
  idle · walk · run(달리기·날기·헤엄) · attack · hit · death · special(그 밖: 먹기·점프·구르기 …)
어느 칸에도 못 맞춘 이름은 other 로 남겨 사람이 본다. 계통(family)은 종 이름 낱말로 가른다: quadruped·bird(날개)·serpent·machine·spirit(괴물·정령) + aquatic·humanoid(인간형은 이 티켓 대상 밖 — 표에만 적음). 못 가른 종은 unknown.
"""
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
from collections import OrderedDict, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'creature_motion_matrix.json')
DIRS = re.compile(r'^(saga-web/saga-\w+/assets/models/(animals\w*|monsters/.+|foes)/|saga-unity/Assets/Art/Creatures/)')
SLOTS = ['idle', 'walk', 'run', 'attack', 'hit', 'death', 'special']
# 앞에서부터 처음 맞는 칸
RULES = [('death', r'death|die|dead|faint|knockout|ko'), ('hit', r'hit|hurt|damage|react|flinch|recoil'),
         ('attack', r'attack|bite|claw|slash|stomp|headbutt|kick|punch|shoot|swipe|slam|spit|sting|charge'),
         ('idle', r'idle|stand|breath|wait|sleep|default|^stay'),
         ('run', r'run|gallop|trot|sprint|fly|flap|glide|swim|hover|dash'), ('walk', r'walk|crawl|slither|move|patrol|march|hop'),
         ('special', r'.')]
FAMILY = [('aquatic', r'fish|turbot|squid|octopus|shark|whale|dolphin|crab|betta|tang|grouper|koi|tuna|puffer|piranha|snapper|tetra|manta|humphead|idol|flower_horn'),
          ('humanoid', r'orc|ninja|skeleton|zombie|wizard|tribal|giant|cyclops|yeti|enemysmall|goblin|witch|worker|soldier'),
          ('bird', r'dragon|wasp|birb|bird|crow|duck|eagle|owl|crane|chicken|parrot|hawk|penguin|flamingo|swan|goose|pigeon|seagull|stork|cuckoo|phoenix|bat\b'),
          ('serpent', r'snake|serpent|worm|eel|dragon_snake|naga|cobra|python|lizard|gecko'),
          ('machine', r'robot|mech|drone|golem_iron|turret|bot\b|tank|cyborg|android'),
          ('spirit', r'ghost|spirit|wisp|fairy|elemental|slime|blob|cthulhu|glub|goleling|hywirl|monkroose|mushroom|tree|specter|wraith|jelly|cloud|alien|demon|imp|fish|squid|octopus|shark|whale|dolphin|crab|bee|armabee|ladybug|spider|scorpion|cactoro'),
          ('quadruped', r'alpaca|bear|boar|deer|fox|wolf|dog|cat|bunny|rabbit|horse|cow|pig|sheep|goat|tiger|lion|panda|monkey|elephant|donkey|moose|stag|hippo|rhino|giraffe|zebra|camel|llama|squirrel|raccoon|mouse|rat|hamster|dino|apatosaurus|parasaurolophus|t_rex|frog|husky|pug|shiba|raptor|trex|triceratops|stegosaurus|yak|buffalo|bull|ram|hog|hyena|cheetah|leopard|badger|otter|skunk|kangaroo|koala|sloth|beaver|pup|kitten|alpaking|mushnub|pigeon_x')]


def git_files():
    r = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    return [x for x in r.stdout.split('\n') if DIRS.match(x) and x.lower().endswith(('.glb', '.gltf'))]


def read_json(path):
    b = open(path, 'rb').read()
    if path.lower().endswith('.gltf'):
        return json.loads(b.decode('utf-8')), b
    jl = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + jl]), b


def species_of(path):
    s = os.path.splitext(os.path.basename(path))[0]
    s = re.sub(r'_[0-9a-f]{8}$', '', s)
    return s


def slot_of(name):
    n = name.lower()
    for slot, rx in RULES:
        if re.search(rx, n):
            return slot


def family_of(sp):
    n = sp.lower()
    for fam, rx in FAMILY:
        if re.search(rx, n):
            return fam
    return 'unknown'


def build():
    seen = {}
    games = defaultdict(set)
    for f in git_files():
        p = os.path.join(ROOT, f)
        try:
            j, b = read_json(p)
        except Exception:  # noqa: BLE001
            continue
        h = hashlib.md5(b).hexdigest()
        g = f.split('/')[1] if f.startswith('saga-web') else 'unity'
        games[h].add(g)
        if h in seen:
            continue
        clips = [a.get('name') or ('anim%d' % i) for i, a in enumerate(j.get('animations', []))]
        sp = species_of(f)
        seen[h] = {'species': sp, 'family': family_of(sp), 'file': f, 'skinned': bool(j.get('skins')), 'clips': clips}
    rows = []
    for h, r in seen.items():
        slots = {s: [] for s in SLOTS}
        for c in r['clips']:
            slots[slot_of(c)].append(c)
        r['slots'] = {s: v for s, v in slots.items() if v}
        r['missing'] = [s for s in SLOTS if s not in r['slots']]
        r['games'] = sorted(games[h])
        rows.append(r)
    rows.sort(key=lambda r: (r['family'], r['species'].lower()))
    return rows


def main():
    rows = build()
    if '--names' in sys.argv:
        for r in rows:
            print(r['family'], r['species'], r['clips'])
        return 0
    tot = defaultdict(int)
    for r in rows:
        for s in SLOTS:
            tot[s] += 1 if s in r['slots'] else 0
    fams = defaultdict(int)
    for r in rows:
        fams[r['family']] += 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out = OrderedDict([('note', 'tools/asset-forge/creature_motion_matrix.py 가 파일 클립 이름에서 읽어 만든 표 — 손으로 고치지 않는다'),
                       ('slots', SLOTS), ('count', len(rows)), ('by_family', dict(fams)), ('with_slot', dict(tot)),
                       ('no_clips', sum(1 for r in rows if not r['clips'])), ('rows', rows)])
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('몸 %d종(내용 기준) · 계통 %s · 클립 없음 %d' % (len(rows), dict(fams), out['no_clips']))
    print('칸별 갖춘 수: ' + ' '.join('%s %d' % (s, tot[s]) for s in SLOTS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
