"""펫·몬스터·탈것 동작 표준 이름(K-0031 단계 2) — 종마다 같은 이름의 동작 일곱 칸을 갖게 맞춘다.

    py tools/asset-forge/creature_std_names.py            # 계획표 data/creature_motion_std.json + 요약(파일은 안 쓴다)
    py tools/asset-forge/creature_std_names.py --apply    # 이름을 맞춘 사본을 tools/_out/creature_std/<종>__<해시6>.glb 로 쓴다(원본 안 건드림)

표준 이름: Idle · Walk · Run · Attack · Hit · Death · Special (+ 있으면 Attack2). 나머지 클립은 `X_<원래 이름>` 으로 남긴다.
  - 칸마다 대표 클립 하나를 고른다(이름이 칸과 같음 > 칸 이름으로 시작 > 짧은 것; Jump 전환은 뒤로).
  - 별칭(alias) — 같은 파일에 있는 클립을 다른 이름으로 한 번 더 걸어 빈칸을 메우는 것만 허용한다(애니메이션 항목 복제, 데이터 안 늘림):
      물고기 Idle·Walk ← 헤엄 느린 것(Swimming_Impulse/Normal) · Walk ↔ Run (없는 쪽만)
    계획표에 alias 로 적고 새로 만든 동작은 아니다. 나머지 빈칸은 still_missing — 단계 3 에서 사용자가 처리 방안을 고른다.
  - 대상: 인간형(humanoid)·클립 0개(정적)는 이름 정리 대상 아님(정적은 still_missing 전부, 인간형은 표에서 제외).
입력 data/creature_motion_matrix.json(creature_motion_matrix.py). .gltf(분리 bin) 4종은 사본에서 뺀다 — 표에만 적는다.
"""
import hashlib
import json
import os
import re
import struct
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MATRIX = os.path.join(HERE, 'data', 'creature_motion_matrix.json')
PLAN = os.path.join(HERE, 'data', 'creature_motion_std.json')
OUT = os.path.join(ROOT, 'tools', '_out', 'creature_std')
STD = {'idle': 'Idle', 'walk': 'Walk', 'run': 'Run', 'attack': 'Attack', 'hit': 'Hit', 'death': 'Death', 'special': 'Special'}
SLOTS = list(STD)


def base(c):
    return c.split('|')[-1]


def rank(slot, c):
    b = base(c).lower()
    w = {'special': ''}.get(slot, slot)
    r = 0 if b == w else 1 if (w and b.startswith(w)) else 2 if (w and w in b) else 3
    return (r, 1 if ('jump' in b or re.search(r'(^|_)to', b)) else 0, len(b))


def pick(slot, clips):
    return sorted(clips, key=lambda c: rank(slot, c))[0] if clips else None


def plan_row(r):
    slots, fam = r['slots'], r['family']
    chosen = {s: pick(s, slots.get(s, [])) for s in SLOTS}
    alias = {}
    if fam == 'aquatic':                       # 헤엄 클립이 칸 'run' 에 몰려 있다
        swims = slots.get('run', [])
        slow = [c for c in swims if re.search(r'impulse|normal|idle|slow', base(c), re.I)]
        if slow:
            for s in ('idle', 'walk'):
                if not chosen[s]:
                    alias[s] = pick('run', slow)
        if not chosen['run'] and swims:
            chosen['run'] = pick('run', swims)
    for a, b in (('walk', 'run'), ('run', 'walk')):
        if not chosen[a] and not alias.get(a) and chosen[b]:
            alias[a] = chosen[b]
    attack2 = [c for c in slots.get('attack', []) if c != chosen['attack']]
    still = [s for s in SLOTS if not chosen[s] and s not in alias]
    std_of = {chosen[s]: STD[s] for s in SLOTS if chosen[s]}
    a2 = pick('attack', attack2)
    if a2 and a2 not in std_of:
        std_of[a2] = 'Attack2'
    names, used = [], set()
    for c in r['clips']:                       # 애니메이션 순서대로 새 이름 — 같은 이름이 두 번 있어도 첫 번째만 표준이 된다
        n = std_of.get(c)
        if n is None or n in used:
            n = 'X_' + base(c)
            k = 2
            while n in used:
                n = 'X_%s_%d' % (base(c), k)
                k += 1
        used.add(n)
        names.append(n)
    mp = OrderedDict((c, n) for c, n in zip(r['clips'], names) if not n.startswith('X_'))
    return {'species': r['species'], 'family': fam, 'file': r['file'], 'games': r['games'], 'clips': r['clips'], 'rename': mp, 'names': names,
            'alias': {STD[s]: c for s, c in alias.items()}, 'still_missing': [STD[s] for s in still]}


def read_glb(p):
    b = open(p, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + jl]), b[20 + jl:]


def write_glb(p, j, rest):
    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    with open(p, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + len(rest)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js + rest)


def apply(row):
    src = os.path.join(ROOT, row['file'])
    if src.endswith('.gltf'):
        return None
    j, rest = read_glb(src)
    anims = j.get('animations', [])
    assert len(anims) == len(row['names']), ('클립 수', row['species'])
    for a, n in zip(anims, row['names']):
        a['name'] = n
    for std, orig in row['alias'].items():
        a = anims[row['clips'].index(orig)]
        cp = json.loads(json.dumps(a))
        cp['name'] = std
        anims.append(cp)
    names = [a['name'] for a in anims]
    assert len(names) == len(set(names)), ('이름 중복', row['species'], names)
    os.makedirs(OUT, exist_ok=True)
    h = hashlib.md5(open(src, 'rb').read()).hexdigest()[:6]
    dst = os.path.join(OUT, '%s__%s.glb' % (row['species'], h))
    write_glb(dst, j, rest)
    return dst


def main():
    m = json.load(open(MATRIX, encoding='utf-8'))
    rows = [plan_row(r) for r in m['rows'] if r['family'] != 'humanoid']
    stat = {}
    for r in rows:
        f = stat.setdefault(r['family'], {'n': 0, 'complete': 0, 'alias': 0, 'still': {}})
        f['n'] += 1
        f['complete'] += 0 if r['still_missing'] else 1
        f['alias'] += 1 if r['alias'] else 0
        for s in r['still_missing']:
            f['still'][s] = f['still'].get(s, 0) + 1
    out = OrderedDict([('note', 'tools/asset-forge/creature_std_names.py 가 만든 계획표 — 손으로 고치지 않는다'), ('standard', list(STD.values()) + ['Attack2']),
                       ('by_family', stat), ('rows', rows)])
    with open(PLAN, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for fam, f in stat.items():
        print('%-9s %2d종 · 일곱 칸 다 참 %2d · 별칭 씀 %2d · 남은 빈칸 %s' % (fam, f['n'], f['complete'], f['alias'], f['still']))
    if '--apply' in sys.argv:
        n = sum(1 for r in rows if r['rename'] and apply(r))
        print('사본 %d개 → %s' % (n, OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
