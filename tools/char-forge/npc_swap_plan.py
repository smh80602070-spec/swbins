"""NPC·병사·적 인간형 군중 조합표 — 도감 299 와 **겹치지 않게** 역할별 (몸 샘플, 상의·하의·신발/원피스 출처) 를 정한다(K-0033).

    py tools/char-forge/npc_swap_plan.py            # data/npc_swap_plan.json 을 쓴다
    py tools/char-forge/npc_swap_plan.py --check    # 겹침(도감 포함)·조각 존재·몸 원래 옷 그대로가 아닌지 검사만

구운 뒤: blender -b --factory-startup -P tools/char-forge/outfit_swap.py -- --plan tools/char-forge/data/npc_swap_plan.json tools/char-forge/_out/parts tools/char-forge/_in/vroid
        → `_in/vroid/npc_*.glb` → bash tools/char-forge/vroid_batch.sh (동작 18·웹 경량본·2D 시트는 batch 가 이어서)
        (군중용 경량본 = 배치의 web 단계 — vrm-slim + Meshopt + WebP 1024. 군중 인스턴스에는 웹이 더 낮춘 텍스처를 쓴다.)

역할표(역할 id, 성별, 수): 도감과 별개로 게임에 대량으로 필요한 인물. 시대 혼합(과거·현대·미래 한 자리)은 시대별 3종 역할(`era_*`)로 둔다.
**한계(기록)**: 옷 조각 모양 분류(병사=갑옷형·학자=긴 옷 …)는 사람이 렌더 시트로 한 번 표시해야 해서 아직 없다 — 지금은 같은 샘플 풀 안에서 몸·옷을 겹치지 않게 섞고,
역할은 성별·수·id 로만 갈린다. 분류가 생기면 `ROLE_FILTER` 에 샘플 글자 목록을 채우면 그 역할은 그 풀에서만 뽑는다. 얼굴·머리 반복은 허용(사용자 "약간 다르게만").
"""
import hashlib
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import outfit_swap_plan as OP  # noqa: E402

OUT = os.path.join(HERE, 'data', 'npc_swap_plan.json')
DEX = os.path.join(HERE, 'data', 'outfit_swap_plan.json')
ROLES = [  # (역할, 성별 'M'/'F'/'MF', 수)
    ('walker', 'M', 18), ('walker', 'F', 18), ('merchant', 'MF', 16), ('soldier', 'M', 24), ('soldier', 'F', 8), ('bandit', 'MF', 16),
    ('scholar', 'MF', 12), ('farmer', 'MF', 14), ('smith', 'M', 8), ('priest', 'MF', 10),
    ('era_past', 'MF', 12), ('era_present', 'MF', 12), ('era_future', 'MF', 12),
]
ROLE_FILTER = {}       # 역할 → 샘플 글자 목록(사람이 옷 모양을 분류한 뒤 채운다). 없으면 성별 풀 전체.


def build():
    parts = OP.load_parts()
    dex = json.load(open(DEX, encoding='utf-8'))['entries']
    used = {(r['body'], tuple(sorted(r['kit'].items()))) for r in dex}
    rng = random.Random(20271004)
    rows = []
    cnt = {}
    for role, gs, n in ROLES:
        for i in range(1, n + 1):
            cnt[role] = cnt.get(role, 0) + 1
            nn = cnt[role]
            if gs == 'MF':
                g = 'M' if int(hashlib.md5(f'{role}{nn}'.encode()).hexdigest(), 16) % 100 < 50 else 'F'
            else:
                g = gs
            pool = [L for L in (OP.MALE if g == 'M' else OP.FEMALE) if L in parts]
            if ROLE_FILTER.get(role):
                pool = [L for L in pool if L in ROLE_FILTER[role]] or pool
            body = pool[(nn * 5 + (3 if g == 'F' else 1)) % len(pool)]
            for _ in range(800):
                dress = [L for L in pool if 'cloth' in parts[L]]
                if dress and g == 'F' and rng.random() < 0.3:
                    kit = {'cloth': rng.choice(dress), 'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
                else:
                    kit = {'top': rng.choice([L for L in pool if 'top' in parts[L]]),
                           'bottom': rng.choice([L for L in pool if 'bottom' in parts[L]]),
                           'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
                key = (body, tuple(sorted(kit.items())))
                if key in used or all(v == body for v in kit.values()):
                    continue
                if 'cloth' not in kit and sum(v == body for v in kit.values()) > 1:
                    continue
                used.add(key)
                break
            else:
                raise SystemExit(f'조합을 못 찾음: {role} {nn}')
            rows.append({'id': f'npc_{role}_{nn:02d}', 'role': role, 'gender': g, 'body': body, 'kit': kit})
    return rows, parts, dex


def check(rows, parts, dex):
    errs = []
    seen = {(r['body'], tuple(sorted(r['kit'].items()))) for r in dex}
    ids = set()
    for r in rows:
        key = (r['body'], tuple(sorted(r['kit'].items())))
        if key in seen:
            errs.append('겹침(도감 포함) ' + r['id'])
        seen.add(key)
        if r['id'] in ids:
            errs.append('id 중복 ' + r['id'])
        ids.add(r['id'])
        for slot, src in r['kit'].items():
            if slot not in parts.get(src, {}):
                errs.append('%s: %s 에 %s 조각 없음' % (r['id'], src, slot))
        if all(v == r['body'] for v in r['kit'].values()):
            errs.append('몸 원래 옷 ' + r['id'])
    return errs


if __name__ == '__main__':
    rows, parts, dex = build()
    errs = check(rows, parts, dex)
    roles = {}
    for r in rows:
        roles[r['role']] = roles.get(r['role'], 0) + 1
    bodies = {}
    for r in rows:
        bodies[r['body']] = bodies.get(r['body'], 0) + 1
    print('NPC', len(rows), '· 역할', roles, '· 몸 사용', len(bodies), '· 오류', len(errs))
    for e in errs[:10]:
        print(' ', e)
    if '--check' not in sys.argv and not errs:
        json.dump({'note': '생성: py tools/char-forge/npc_swap_plan.py — 손으로 고치지 않는다(K-0033)', 'entries': rows},
                  open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('쓰기', OUT)
    sys.exit(1 if errs else 0)
